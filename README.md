# 🔄 Pivoteador Universal

App de **Streamlit** para transponer / pivotear cualquier archivo **Excel** o **CSV**
sin tocar código. Reemplaza los notebooks de Colab `pivotear distribuccion.ipynb`
y `pivotear esmeralda.ipynb` por una sola herramienta web configurable.

## ¿Qué hace?

Tres modos de pivoteo, todos configurables desde la interfaz:

| Modo | Para qué sirve | Reemplaza a |
|------|----------------|-------------|
| **Unpivot simple** | Columnas fijas + columnas a transponer → formato largo (`melt`). | `pivotear distribuccion` |
| **Unpivot por pares/grupos** | Columnas emparejadas (`P.1/Lt.1`, `P.2/Lt.2`…) que se funden por posición. | `pivotear esmeralda` |
| **Pivot largo → ancho** | Lo inverso: agrupa filas y expande una columna en varias (`pivot_table`). | — (nuevo) |

Además:

- Acepta `.xlsx`, `.xls` y `.csv`; permite **elegir la hoja** y la **fila de encabezado**.
- **Detección automática** de patrones de columnas (`Suma de…`, pares `P.` / `Lt.`).
- **Vista previa** del archivo original y del resultado.
- **Descarga** en Excel o CSV.

## Estructura del repositorio

```
pivoteador-app/
├── app.py                 # Interfaz Streamlit
├── pivot_core.py          # Lógica de pivoteo (sin dependencia de la UI)
├── requirements.txt       # Dependencias
├── .gitignore
├── .streamlit/
│   └── config.toml        # Tema y tamaño máximo de subida
└── README.md
```

## Uso local

```bash
# 1. Clonar e instalar
git clone https://github.com/TU_USUARIO/pivoteador-app.git
cd pivoteador-app
pip install -r requirements.txt

# 2. Ejecutar
streamlit run app.py
```

Se abrirá en `http://localhost:8501`.

## Despliegue en Streamlit Community Cloud (gratis)

1. **Sube este proyecto a GitHub** (repo público o privado):

   ```bash
   git init
   git add .
   git commit -m "Pivoteador Universal"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/pivoteador-app.git
   git push -u origin main
   ```

2. Entra a **https://share.streamlit.io** e inicia sesión con tu cuenta de GitHub.

3. Haz clic en **"Create app" → "Deploy a public app from GitHub"** y completa:
   - **Repository:** `TU_USUARIO/pivoteador-app`
   - **Branch:** `main`
   - **Main file path:** `app.py`

4. Pulsa **Deploy**. En 1–2 minutos tendrás una URL pública del tipo
   `https://tu-usuario-pivoteador-app.streamlit.app`.

> Cada vez que hagas `git push` a `main`, Streamlit Cloud **redespliega solo**.

### Notas de despliegue

- **No necesitas** `google.colab` ni `files.upload()` / `files.download()`: en la
  web se usan el cargador de archivos y el botón de descarga de Streamlit.
- Si necesitas subir archivos mayores a 200 MB, ajusta `maxUploadSize` en
  `.streamlit/config.toml`.
- Si más adelante usas credenciales (APIs, bases de datos), ponlas en
  **Settings → Secrets** de la app, nunca en el código.

## De Colab a esta app — equivalencias

| Colab | Esta app |
|-------|----------|
| `files.upload()` | Cargador de archivos (paso 1) |
| `pd.read_excel(...)` | Lectura automática + selector de hoja |
| `df.melt(id_vars=..., value_vars=...)` | Modo *Unpivot simple* |
| Melt de `P.`/`Lt.` + `merge` por posición | Modo *Unpivot por pares/grupos* |
| `df.to_excel(...)` + `files.download(...)` | Botón **Descargar** (Excel o CSV) |

## Licencia

Uso libre. Adáptalo a tu gusto.
