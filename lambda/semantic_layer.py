# ========================
# Semantic Layer Loader 
# ========================

# Environment imports
import json
import os
import boto3

# client for S3 access
s3 = boto3.client("s3")

# Cache semantic layer across warm Lambda invocations
_SEM_CACHE = None


def load_semantic_layer() -> dict:
    """Loading semantic layer JSON from S3 in _SEM_CACHE. Cached for warm starts."""
    global _SEM_CACHE
    
    # Return cached version if available
    if _SEM_CACHE is not None:
        return _SEM_CACHE

    # Load semantic layer file from S3
    semantic_s3 = os.environ.get("SEMANTIC_LAYER_S3", "").strip()
    if not semantic_s3:
        raise ValueError("SEMANTIC_LAYER_S3 is not set in environment variables")

    # Validate S3 path format
    if not semantic_s3.startswith("s3://"):
        raise ValueError("SEMANTIC_LAYER_S3 must start with s3://")

    # Parse bucket and key from S3 path
    parts = semantic_s3.replace("s3://", "", 1).split("/", 1)
    bucket = parts[0]
    key = parts[1] if len(parts) > 1 else ""

    # Validate bucket and key
    if not key:
        raise ValueError("SEMANTIC_LAYER_S3 must include an object key after the bucket")

    # Fetch and load the semantic layer JSON from S3 as _SEM_CACHE
    obj = s3.get_object(Bucket=bucket, Key=key)
    body = obj["Body"].read().decode("utf-8")
    _SEM_CACHE = json.loads(body)
    return _SEM_CACHE
