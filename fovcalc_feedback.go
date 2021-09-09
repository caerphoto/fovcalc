package main

import (
  "log"
  "net/http"
  "fmt"
  "io"
  "os"
  "encoding/hex"
  "crypto/md5"
)

type Feedback struct {
  Name string
  Text string
  Md5 string
}

func main() {
  listen := "127.0.0.1:9933"
  http.HandleFunc("/fovcalc_feedback", Handler)
  log.Printf("Listening on %s; PID = %d", listen, os.Getpid())
  log.Fatal(http.ListenAndServe(listen, nil))
}

func Handler(w http.ResponseWriter, r *http.Request) {
  feedback := extractFormData(r)

  if isValidMd5(feedback) {
    log.Printf("Received feedback from \033[0;33m%s\033[0m:\n>\033[0;36m%s\033[0m<\n", feedback.Name, feedback.Text)
    fmt.Fprintf(w, "OK")
    return
  } else {
    http.Error(w, "Bad Request", 400)
  }
}

func extractFormData(r *http.Request) Feedback {
  r.ParseMultipartForm(8192)
  return Feedback{
    Name: r.PostForm.Get("feedback-name"),
    Text: r.PostForm.Get("feedback-text"),
    Md5: r.PostForm.Get("feedback-checksum"),
  }
}

func isValidMd5(feedback Feedback) bool {
  data := feedback.Text
  hex := hexedHash(data)
  if hex != feedback.Md5 {
    log.Printf("Hash mismatch. Sent: %s, calc: %s\n", feedback.Md5, hex)
  }
  return hex == feedback.Md5
}

func hexedHash(s string) string {
  hash := md5.New()
  io.WriteString(hash, s)
  return hex.EncodeToString(hash.Sum(nil))
}
