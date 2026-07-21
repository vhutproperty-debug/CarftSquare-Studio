import json, subprocess, time, urllib.request

def status():
    raw = subprocess.check_output(
        ["gh", "api", "repos/vhutproperty-debug/CarftSquare-Studio/commits/4a27500/status"],
        text=True,
    )
    data = json.loads(raw)
    vercel = next(s for s in data["statuses"] if s["context"] == "Vercel")
    return vercel["state"], vercel.get("description", ""), vercel.get("target_url", "")

for i in range(30):
    state, desc, url = status()
    print(f"[{i}] {state} | {desc}", flush=True)
    if state in ("success", "failure", "error"):
        print("URL:", url, flush=True)
        raise SystemExit(0 if state == "success" else 1)
    time.sleep(15)

print("timed out waiting for vercel")
raise SystemExit(2)
