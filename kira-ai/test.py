
import requests, base64
from pathlib import Path

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = True

def read_b64(path):
  with open(path, "rb") as f:
    return base64.b64encode(f.read()).decode()
BASE_DIR = Path(__file__).resolve().parent
image_b64s = [read_b64(str(BASE_DIR / "data.jpeg"))]
PROMPT = (
  "Extract transaction data from this image and return ONLY valid JSON "
  "(no markdown, no explanation) with exactly this schema: "
  "{\"datetime\":\"\", \"money\":\"\", \"text\":\"\", \"type\":\"\"}. "
  "Rules: type must be one of withdraw, deposit, bonus. "
  "If the image contains multiple withdraw rows (e.g., 2 lines), return only "
  "the latest/newest withdraw row as a single JSON object. "
  "If a field is missing, use an empty string."
)

headers = {
  "Authorization": "Bearer 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",
  "Accept": "text/event-stream" if stream else "application/json"
}

payload = {
  "model": "google/gemma-4-31b-it",
  "messages": [
      {
        "role": "user",
        "content": [{"type":"image_url","image_url":{"url":f"data:image/png;base64,{image_b64s[0]}"}},{"type":"text","text":PROMPT}]
      }
    ],
  "max_tokens": 1024,
  "temperature": 1.00,
  "top_p": 0.95,
  "stream": stream,
  "chat_template_kwargs": {"enable_thinking": True},
}


response = requests.post(invoke_url, headers=headers, json=payload, stream=stream)
if stream:
    for line in response.iter_lines():
        if line:
            print(line.decode("utf-8"))
else:
    print(response.json())