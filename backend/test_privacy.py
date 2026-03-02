import urllib.request
import json
import urllib.parse
import urllib.error

BASE_URL = "http://localhost:8000"

def req(method, endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = None
    if data:
        body = json.dumps(data).encode('utf-8')
    
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Error {method} {endpoint}: {e.read().decode()}")
        raise

def get_token(username, password):
    url = f"{BASE_URL}/token"
    data = urllib.parse.urlencode({'username': username, 'password': password}).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())["access_token"]

try:
    print("1. Registering Alice...")
    try:
        req("POST", "/register", {"username": "Alice", "password": "pw", "gender": "female"})
    except Exception:
        pass # Maybe already exists
    token_alice = get_token("Alice", "pw")
    print("Alice Token Obtained")

    print("2. Registering Bob...")
    try:
        req("POST", "/register", {"username": "Bob", "password": "pw", "gender": "male"})
    except Exception:
        pass
    token_bob = get_token("Bob", "pw")
    print("Bob Token Obtained")

    print("3. Creating Project Alpha (Alice)...")
    proj = req("POST", "/projects", {"name": "Alpha"}, token=token_alice)
    pid = proj["id"]
    print(f"Project Created: ID {pid}")

    print("4. Creating Private Room 'Secret' (Alice)...")
    req("POST", "/rooms", {"name": "Secret", "project_id": pid, "is_private": True}, token=token_alice)

    print("5. Creating Public Room 'General' (Alice)...")
    req("POST", "/rooms", {"name": "General", "project_id": pid, "is_private": False}, token=token_alice)

    print("6. Verifying Alice View...")
    rooms_alice = req("GET", f"/rooms/{pid}", token=token_alice)
    alice_names = [r["name"] for r in rooms_alice]
    print(f"Alice sees: {alice_names}")
    
    if "Secret" not in alice_names or "General" not in alice_names:
        print("FAIL: Alice should see both rooms")
        exit(1)

    print("7. Verifying Bob cannot list project rooms before joining...")
    try:
        req("GET", f"/rooms/{pid}", token=token_bob)
        print("FAIL: Bob should not be able to list rooms before joining project")
        exit(1)
    except urllib.error.HTTPError as e:
        if e.code != 403:
            print(f"FAIL: Expected 403, got {e.code}")
            exit(1)
        print("Bob correctly blocked with 403")

    print("8. Bob joins project and verifies room visibility...")
    req("POST", f"/projects/{pid}/join", token=token_bob)
    rooms_bob = req("GET", f"/rooms/{pid}", token=token_bob)
    bob_names = [r["name"] for r in rooms_bob]
    print(f"Bob sees after join: {bob_names}")

    if "Secret" in bob_names:
        print("FAIL: Bob sees Secret room!")
        exit(1)
    if "General" not in bob_names:
        print("FAIL: Bob should see General room after joining")
        exit(1)

    print("SUCCESS: Privacy logic verified!")

except Exception as e:
    print(f"Test Failed: {e}")
    exit(1)
