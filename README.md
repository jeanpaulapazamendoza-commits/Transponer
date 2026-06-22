# 🔄 Transpositor dinámico de archivos

App web hecha con Streamlit para subir cualquier Excel/CSV en **formato ancho**
y convertirlo a **formato largo** (despivotar / transponer) sin perder datos.

## ¿Qué hace?

Detecta automáticamente dos patrones comunes y permite ajustarlos a mano:

1. **Simple** — apila varias columnas de un mismo concepto en una sola.
   Ejemplo: `Suma de Lunes`, `Suma de Martes`, … → columnas `Dia` + `Valor`.
2. **Emparejado** — despivota grupos de columnas relacionadas por posición,
   manteniendo la relación entre ellas.
   Ejemplo: `P. 1`/`Lt. 1`, `P. 2`/`Lt. 2`, … → columnas `Posicion` + `P` + `Lt`.

Puedes elegir las columnas fijas, las que se transponen, conservar o no las
celdas vacías, y descargar el resultado en Excel o CSV.

## Archivos del proyecto

```
app.py            # interfaz de Streamlit
transponer.py     # lógica de detección y transposición (reutilizable)
requirements.txt  # dependencias
```

## Ejecutar en local

```bash
pip install -r requirements.txt
streamlit run app.py
```

Se abrirá en `http://localhost:8501`.

## Publicar en GitHub + Streamlit Cloud

1. **Sube el código a GitHub**
   ```bash
   git init
   git add .
   git commit -m "App transpositor de archivos"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/transponer-app.git
   git push -u origin main
   ```

2. **Conecta Streamlit Cloud**
   - Entra a https://share.streamlit.io e inicia sesión con GitHub.
   - Pulsa **New app** → selecciona tu repositorio `transponer-app`,
     la rama `main` y el archivo principal `app.py`.
   - Pulsa **Deploy**. En 1–2 minutos tendrás un link público que puedes
     compartir.

Cada vez que hagas `git push`, la app se actualiza sola.

## Notas

- No se guarda ningún archivo en el servidor: todo se procesa en memoria.
- Soporta `.xlsx`, `.xls` y `.csv` (con autodetección de separador).
- Si el detector automático no acierta, cambia el modo o ajusta las columnas
  manualmente; el resultado se recalcula al instante.
