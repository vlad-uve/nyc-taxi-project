#=======================
# HTTP Utilities
#=======================

# Environment imports
import json


def _resp(status: int, body: dict):
    """Standard JSON response + CORS for browser-based Next.js demo."""
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "https://frontend-test.d5ftrm9s2ee69.amplifyapp.com",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body),
    }