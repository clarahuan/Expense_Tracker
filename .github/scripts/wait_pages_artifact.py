"""Wait for artifact metadata visibility; never log authentication headers."""
import json
import os
import time
import urllib.request

endpoint = f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}/artifacts?per_page=100"
headers = {'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Qingji-Pages'}
for attempt in range(10):
    with urllib.request.urlopen(urllib.request.Request(endpoint, headers=headers), timeout=20) as response:
        result = json.load(response)
    if any(a['name'] == 'github-pages' and not a['expired'] for a in result.get('artifacts', [])):
        print('Pages artifact metadata is available.')
        break
    print(f'Waiting for Pages artifact metadata ({attempt + 1}/10).')
    time.sleep(5)
else:
    raise RuntimeError('Pages artifact metadata unavailable; retry the deploy job after GitHub recovers.')
