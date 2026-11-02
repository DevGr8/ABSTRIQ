"""
api/index.py
Vercel Serverless WSGI Handler for ABSTRIQ Flask Backend
"""

import sys
from pathlib import Path

# Add root directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app import app

class VercelRewriteMiddleware:
    """Corrects WSGI PATH_INFO from Vercel's x-matched-path header on rewrites."""
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = environ.get("HTTP_X_MATCHED_PATH") or environ.get("HTTP_X_VERCEL_MATCHED_PATH")
        if matched_path:
            # Strip query strings if present in matched_path
            path_only = matched_path.split("?")[0]
            environ["PATH_INFO"] = path_only
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelRewriteMiddleware(app.wsgi_app)
