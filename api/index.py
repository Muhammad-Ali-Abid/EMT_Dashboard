from flask import Flask
import os
import pandas as pd

app = Flask(__name__)

# Load once when the app initializes
basedir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(basedir, '..', 'public_emdat_incl_hist_2026-05-18.xlsx')
df = pd.read_excel(file_path)

@app.route('/')
def index():
    # You can now use the 'df' variable directly in your routes
    return df.head().to_html()