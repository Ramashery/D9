// firestore-sync — генератор данных для Hugo.
//
// Читает Firestore (REST API, только стандартная библиотека Go — без внешних
// зависимостей, поэтому `go run` стартует мгновенно) и пишет два файла,
// которые Hugo читает как site.Data:
//
//	data/home.json      ← документ  site/home
//	data/sections.json  ← коллекция sections (сортировка по полю order)
//
// Режимы:
//
//	go run .            скачать из Firestore → data/*.json
//	go run . -seed      залить data/*.json в Firestore (первичное наполнение)
//
// Переменные окружения:
//
//	FIREBASE_PROJECT_ID  обязательна; если пуста — генератор ничего не делает и
//	                     Hugo собирается из закоммиченных data/*.json
//	FIREBASE_SA_JSON     (необязательно) содержимое JSON сервисного аккаунта.
//	                     Нужен для -seed и для закрытых коллекций.
//	                     Без него чтение идёт анонимно (правила: allow read).
package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	scope      = "https://www.googleapis.com/auth/datastore"
	homeDoc    = "site/home"
	sectionsCl = "sections"
)

// ---------------------------------------------------------------- auth

type serviceAccount struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

func b64(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

// accessToken подписывает JWT (RS256) ключом сервисного аккаунта и меняет его
// на OAuth-токен. Всё на stdlib.
func accessToken(ctx context.Context, saJSON string) (string, error) {
	var sa serviceAccount
	if err := json.Unmarshal([]byte(saJSON), &sa); err != nil {
		return "", fmt.Errorf("разбор FIREBASE_SA_JSON: %w", err)
	}
	if sa.TokenURI == "" {
		sa.TokenURI = "https://oauth2.googleapis.com/token"
	}
	block, _ := pem.Decode([]byte(sa.PrivateKey))
	if block == nil {
		return "", errors.New("private_key: не удалось прочитать PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("private_key: %w", err)
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return "", errors.New("private_key: ожидается RSA")
	}

	now := time.Now().Unix()
	hdr, _ := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT"})
	clm, _ := json.Marshal(map[string]any{
		"iss": sa.ClientEmail, "scope": scope, "aud": sa.TokenURI,
		"iat": now, "exp": now + 3600,
	})
	input := b64(hdr) + "." + b64(clm)
	sum := sha256.Sum256([]byte(input))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, sum[:])
	if err != nil {
		return "", err
	}

	form := url.Values{
		"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"assertion":  {input + "." + b64(sig)},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sa.TokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("oauth: %s: %s", resp.Status, body)
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tok); err != nil || tok.AccessToken == "" {
		return "", errors.New("oauth: в ответе нет access_token")
	}
	return tok.AccessToken, nil
}

// ---------------------------------------------------------------- client

type client struct {
	http  *http.Client
	base  string
	token string
}

func (c *client) do(ctx context.Context, method, path string, q url.Values, body any) ([]byte, error) {
	u := c.base + "/" + path
	if len(q) > 0 {
		u += "?" + q.Encode()
	}
	var payload []byte
	if body != nil {
		var err error
		if payload, err = json.Marshal(body); err != nil {
			return nil, err
		}
	}
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*attempt) * 500 * time.Millisecond)
		}
		req, err := http.NewRequestWithContext(ctx, method, u, bytes.NewReader(payload))
		if err != nil {
			return nil, err
		}
		if payload != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		if c.token != "" {
			req.Header.Set("Authorization", "Bearer "+c.token)
		}
		resp, err := c.http.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		data, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		switch {
		case resp.StatusCode == http.StatusOK:
			return data, nil
		case resp.StatusCode == 429 || resp.StatusCode >= 500:
			lastErr = fmt.Errorf("%s %s → %s", method, path, resp.Status)
		default:
			return nil, fmt.Errorf("%s %s → %s: %s", method, path, resp.Status, data)
		}
	}
	return nil, lastErr
}

// ---------------------------------------------------------------- Firestore ⇄ JSON

func decodeFields(f map[string]any) map[string]any {
	out := make(map[string]any, len(f))
	for k, v := range f {
		if m, ok := v.(map[string]any); ok {
			out[k] = decodeValue(m)
		}
	}
	return out
}

func decodeValue(v map[string]any) any {
	for kind, raw := range v {
		switch kind {
		case "stringValue", "booleanValue", "doubleValue", "timestampValue", "referenceValue", "geoPointValue":
			return raw
		case "integerValue":
			if s, ok := raw.(string); ok {
				if n, err := strconv.ParseInt(s, 10, 64); err == nil {
					return n
				}
			}
			return raw
		case "nullValue":
			return nil
		case "arrayValue":
			out := []any{}
			if m, ok := raw.(map[string]any); ok {
				if vals, ok := m["values"].([]any); ok {
					for _, it := range vals {
						if im, ok := it.(map[string]any); ok {
							out = append(out, decodeValue(im))
						}
					}
				}
			}
			return out
		case "mapValue":
			if m, ok := raw.(map[string]any); ok {
				if f, ok := m["fields"].(map[string]any); ok {
					return decodeFields(f)
				}
			}
			return map[string]any{}
		}
	}
	return nil
}

func encodeValue(v any) map[string]any {
	switch t := v.(type) {
	case nil:
		return map[string]any{"nullValue": nil}
	case string:
		return map[string]any{"stringValue": t}
	case bool:
		return map[string]any{"booleanValue": t}
	case float64:
		if t == math.Trunc(t) && math.Abs(t) < 1e15 {
			return map[string]any{"integerValue": strconv.FormatInt(int64(t), 10)}
		}
		return map[string]any{"doubleValue": t}
	case []any:
		vals := make([]any, 0, len(t))
		for _, it := range t {
			vals = append(vals, encodeValue(it))
		}
		if len(vals) == 0 {
			return map[string]any{"arrayValue": map[string]any{}}
		}
		return map[string]any{"arrayValue": map[string]any{"values": vals}}
	case map[string]any:
		return map[string]any{"mapValue": map[string]any{"fields": encodeFields(t)}}
	}
	return map[string]any{"nullValue": nil}
}

func encodeFields(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = encodeValue(v)
	}
	return out
}

// ---------------------------------------------------------------- read

func (c *client) getDoc(ctx context.Context, path string) (map[string]any, error) {
	data, err := c.do(ctx, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}
	var doc struct {
		Fields map[string]any `json:"fields"`
	}
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	return decodeFields(doc.Fields), nil
}

func (c *client) listDocs(ctx context.Context, collection string) ([]map[string]any, error) {
	var all []map[string]any
	token := ""
	for {
		q := url.Values{"pageSize": {"300"}}
		if token != "" {
			q.Set("pageToken", token)
		}
		data, err := c.do(ctx, http.MethodGet, collection, q, nil)
		if err != nil {
			return nil, err
		}
		var page struct {
			Documents []struct {
				Name   string         `json:"name"`
				Fields map[string]any `json:"fields"`
			} `json:"documents"`
			NextPageToken string `json:"nextPageToken"`
		}
		if err := json.Unmarshal(data, &page); err != nil {
			return nil, err
		}
		for _, d := range page.Documents {
			m := decodeFields(d.Fields)
			if _, has := m["id"]; !has {
				m["id"] = d.Name[strings.LastIndex(d.Name, "/")+1:]
			}
			all = append(all, m)
		}
		if page.NextPageToken == "" {
			return all, nil
		}
		token = page.NextPageToken
	}
}

func num(v any) float64 {
	switch t := v.(type) {
	case int64:
		return float64(t)
	case float64:
		return t
	}
	return math.MaxFloat64
}

// ---------------------------------------------------------------- files

func writeJSON(path string, v any) error {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return err
	}
	// не трогаем файл, если ничего не изменилось (чистый git diff, кэш Hugo)
	if old, err := os.ReadFile(path); err == nil && bytes.Equal(old, buf.Bytes()) {
		log.Printf("без изменений: %s", path)
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, buf.Bytes(), 0o644); err != nil {
		return err
	}
	log.Printf("записан: %s (%d байт)", path, buf.Len())
	return os.Rename(tmp, path)
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

// ---------------------------------------------------------------- main

func main() {
	out := flag.String("out", "../../data/en", "куда писать home.json и sections.json (по языку: data/<lang>)")
	seed := flag.Bool("seed", false, "залить JSON из -out в Firestore (нужен FIREBASE_SA_JSON)")
	flag.Parse()
	log.SetFlags(0)

	project := os.Getenv("FIREBASE_PROJECT_ID")
	if project == "" {
		log.Println("FIREBASE_PROJECT_ID не задан — оставляю закоммиченные data/*.json")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	c := &client{
		http: &http.Client{Timeout: 30 * time.Second},
		base: "https://firestore.googleapis.com/v1/projects/" + project + "/databases/(default)/documents",
	}
	if sa := os.Getenv("FIREBASE_SA_JSON"); sa != "" {
		tok, err := accessToken(ctx, sa)
		if err != nil {
			log.Fatalf("авторизация: %v", err)
		}
		c.token = tok
	}

	if *seed {
		if c.token == "" {
			log.Fatal("для -seed нужен FIREBASE_SA_JSON")
		}
		if err := runSeed(ctx, c, *out); err != nil {
			log.Fatalf("seed: %v", err)
		}
		return
	}

	home, err := c.getDoc(ctx, homeDoc)
	if err != nil {
		log.Fatalf("чтение %s: %v", homeDoc, err)
	}
	sections, err := c.listDocs(ctx, sectionsCl)
	if err != nil {
		log.Fatalf("чтение %s: %v", sectionsCl, err)
	}
	// защита от публикации пустого сайта
	if len(home) == 0 || len(sections) == 0 {
		log.Fatalf("Firestore вернул пустые данные (home=%d полей, sections=%d) — сборка остановлена", len(home), len(sections))
	}
	sort.SliceStable(sections, func(i, j int) bool { return num(sections[i]["order"]) < num(sections[j]["order"]) })

	if err := writeJSON(filepath.Join(*out, "home.json"), home); err != nil {
		log.Fatal(err)
	}
	if err := writeJSON(filepath.Join(*out, "sections.json"), sections); err != nil {
		log.Fatal(err)
	}
	log.Printf("готово: %d секций", len(sections))
}

func runSeed(ctx context.Context, c *client, dir string) error {
	var home map[string]any
	if err := readJSON(filepath.Join(dir, "home.json"), &home); err != nil {
		return err
	}
	var sections []map[string]any
	if err := readJSON(filepath.Join(dir, "sections.json"), &sections); err != nil {
		return err
	}
	put := func(path string, fields map[string]any) error {
		_, err := c.do(ctx, http.MethodPatch, path, nil, map[string]any{"fields": encodeFields(fields)})
		if err == nil {
			log.Printf("залит: %s", path)
		}
		return err
	}
	if err := put(homeDoc, home); err != nil {
		return err
	}
	for i, s := range sections {
		id, _ := s["id"].(string)
		if id == "" {
			return fmt.Errorf("в sections[%d] нет поля id", i)
		}
		s["order"] = float64(i + 1)
		if err := put(sectionsCl+"/"+id, s); err != nil {
			return err
		}
	}
	return nil
}
