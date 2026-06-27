# ShelfWatch Error Annotation Portal

A Streamlit portal to visually inspect ShelfWatch recognition errors.  
Upload your `df_out` CSV and see every wrong detection overlaid on the shelf image — with cropped zoom panels per annotation.

## What it shows

- Only `annotation_type = SKU` rows where `wrong_group = 1` OR `wrong_class = 1`
- Bounding boxes color-coded:
  - 🟣 Purple — wrong group + wrong class
  - 🟠 Amber — wrong group only
  - 🔴 Red — wrong class only
- Cropped zoom strip below each image (one tile per error annotation)
- Annotation detail table (collapsible) with actual vs. predicted labels
- Direct link to the ShelfWatch viewer per image

## Filters

- Error type (any / WG+WC / WG only / WC only)
- Category, Shop, Date
- Images per page (4–24)
- Toggle zoom strip and annotation tables on/off

## Run locally

```bash
# 1. Clone / download this folder
cd shelfwatch_portal

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
streamlit run app.py
```

Opens at `http://localhost:8501` in your browser.

## Deploy to Streamlit Community Cloud (free)

1. Push this folder to a GitHub repo (public or private)
2. Go to https://share.streamlit.io → **New app**
3. Select your repo, branch `main`, file `app.py`
4. Click **Deploy** — done. You get a public URL to share.

No server, no Docker, no config needed.

## Folder structure

```
shelfwatch_portal/
├── app.py            # main portal
├── requirements.txt  # dependencies
└── README.md
```
