"""
Transpositor dinámico de archivos (ancho -> largo)
---------------------------------------------------
App de Streamlit para subir cualquier Excel/CSV y despivotarlo sin perder datos.

Detecta automáticamente dos casos comunes:
  • Columnas emparejadas por posición  (P. 1 / Lt. 1, P. 2 / Lt. 2, ...)
  • Columnas repetidas de un mismo concepto (Suma de Lunes, Suma de Martes, ...)

Permite ajustar manualmente qué columnas son fijas y cuáles se transponen.
"""

import io
import pandas as pd
import streamlit as st

from transponer import (
    sugerir_configuracion,
    transponer_simple,
    transponer_emparejado,
    detectar_grupos_emparejados,
)

st.set_page_config(page_title="Transpositor de archivos", page_icon="🔄", layout="wide")

st.title("🔄 Transpositor dinámico de archivos")
st.caption(
    "Sube un Excel o CSV en formato ancho y conviértelo a formato largo "
    "(despivotar / transponer) sin perder datos."
)


# ----------------------------------------------------------------------------
# Utilidades de lectura / escritura
# ----------------------------------------------------------------------------
@st.cache_data(show_spinner=False)
def leer_archivo(contenido: bytes, nombre: str, hoja=None):
    """Lee CSV o Excel desde bytes. Devuelve (df, hojas_disponibles)."""
    nombre = nombre.lower()
    if nombre.endswith(".csv"):
        # Autodetección sencilla de separador
        try:
            df = pd.read_csv(io.BytesIO(contenido), sep=None, engine="python")
        except Exception:
            df = pd.read_csv(io.BytesIO(contenido))
        return df, None

    xls = pd.ExcelFile(io.BytesIO(contenido))
    hojas = xls.sheet_names
    hoja = hoja or hojas[0]
    df = pd.read_excel(xls, sheet_name=hoja)
    return df, hojas


def df_a_excel_bytes(df: pd.DataFrame) -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Transpuesto")
    return buffer.getvalue()


def df_a_csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8-sig")


# ----------------------------------------------------------------------------
# 1) Carga del archivo
# ----------------------------------------------------------------------------
archivo = st.file_uploader(
    "Sube tu archivo",
    type=["xlsx", "xls", "csv"],
    help="Formatos soportados: Excel (.xlsx, .xls) y CSV.",
)

if archivo is None:
    st.info("👆 Sube un archivo para comenzar.")
    st.stop()

contenido = archivo.getvalue()

# Selección de hoja (solo Excel con varias hojas)
hoja_sel = None
if not archivo.name.lower().endswith(".csv"):
    _, hojas = leer_archivo(contenido, archivo.name)
    if hojas and len(hojas) > 1:
        hoja_sel = st.selectbox("Hoja de Excel a usar:", hojas)

df, _ = leer_archivo(contenido, archivo.name, hoja_sel)
df.columns = df.columns.astype(str).str.strip()

st.subheader("Vista previa de los datos originales")
st.dataframe(df.head(20), use_container_width=True)
st.caption(f"{df.shape[0]:,} filas × {df.shape[1]} columnas")


# ----------------------------------------------------------------------------
# 2) Configuración (auto + manual)
# ----------------------------------------------------------------------------
cfg = sugerir_configuracion(df)
columnas = list(df.columns)

st.subheader("⚙️ Configuración de la transposición")

modo = st.radio(
    "Modo de transposición",
    options=["simple", "emparejado"],
    index=0 if cfg["modo"] == "simple" else 1,
    format_func=lambda m: {
        "simple": "Simple — apilar varias columnas en una sola",
        "emparejado": "Emparejado — columnas relacionadas por posición (P.1/Lt.1...)",
    }[m],
    horizontal=False,
)

conservar_vacios = st.checkbox(
    "Conservar filas con valores vacíos (incluye ceros y celdas en blanco)",
    value=True,
    help="Desactívalo si quieres eliminar las filas que quedan sin valor tras transponer.",
)

resultado = None

if modo == "simple":
    fijas_def = cfg.get("columnas_fijas", columnas[:1]) if cfg["modo"] == "simple" else []
    trans_def = (
        cfg.get("columnas_a_transponer", [])
        if cfg["modo"] == "simple"
        else [c for c in columnas if c not in fijas_def]
    )

    col1, col2 = st.columns(2)
    with col1:
        columnas_fijas = st.multiselect(
            "Columnas FIJAS (se repiten en cada fila)",
            options=columnas,
            default=[c for c in fijas_def if c in columnas],
        )
    with col2:
        opciones_trans = [c for c in columnas if c not in columnas_fijas]
        columnas_trans = st.multiselect(
            "Columnas A TRANSPONER (se apilan)",
            options=opciones_trans,
            default=[c for c in trans_def if c in opciones_trans],
        )

    c1, c2 = st.columns(2)
    with c1:
        nombre_cat = st.text_input("Nombre de la columna de categoría", value="Variable")
    with c2:
        nombre_val = st.text_input("Nombre de la columna de valor", value="Valor")

    if columnas_trans:
        resultado = transponer_simple(
            df, columnas_fijas, columnas_trans,
            nombre_categoria=nombre_cat or "Variable",
            nombre_valor=nombre_val or "Valor",
            conservar_vacios=conservar_vacios,
        )
    else:
        st.warning("Selecciona al menos una columna a transponer.")

else:  # emparejado
    grupos_detectados = (
        cfg.get("grupos") if cfg["modo"] == "emparejado"
        else detectar_grupos_emparejados(columnas)
    )

    if not grupos_detectados:
        st.warning(
            "No se detectaron columnas emparejadas por número (ej: 'P. 1', 'Lt. 1'). "
            "Usa el modo Simple o renombra las columnas."
        )
    else:
        prefijos = list(grupos_detectados.keys())
        st.write("Grupos de columnas detectados (por prefijo y posición):")
        for p, mapping in grupos_detectados.items():
            posiciones = ", ".join(f"{p}{n}" for n in sorted(mapping))
            st.markdown(f"- **{p}** → {posiciones}")

        prefijos_sel = st.multiselect(
            "Grupos a incluir",
            options=prefijos,
            default=prefijos,
        )
        cols_en_grupos = {
            c for pre in prefijos_sel for c in grupos_detectados[pre].values()
        }
        columnas_fijas = st.multiselect(
            "Columnas FIJAS",
            options=[c for c in columnas if c not in cols_en_grupos],
            default=[c for c in columnas if c not in cols_en_grupos],
        )
        nombre_pos = st.text_input("Nombre de la columna de posición", value="Posicion")

        if prefijos_sel:
            grupos_filtrados = {p: grupos_detectados[p] for p in prefijos_sel}
            resultado = transponer_emparejado(
                df, columnas_fijas, grupos_filtrados,
                nombre_posicion=nombre_pos or "Posicion",
                conservar_vacios=conservar_vacios,
            )
        else:
            st.warning("Selecciona al menos un grupo.")


# ----------------------------------------------------------------------------
# 3) Resultado y descarga
# ----------------------------------------------------------------------------
if resultado is not None and not resultado.empty:
    st.subheader("✅ Resultado transpuesto")
    st.dataframe(resultado.head(50), use_container_width=True)
    st.caption(f"{resultado.shape[0]:,} filas × {resultado.shape[1]} columnas")

    base = archivo.name.rsplit(".", 1)[0]
    col_dl1, col_dl2 = st.columns(2)
    with col_dl1:
        st.download_button(
            "⬇️ Descargar Excel",
            data=df_a_excel_bytes(resultado),
            file_name=f"{base}_transpuesto.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )
    with col_dl2:
        st.download_button(
            "⬇️ Descargar CSV",
            data=df_a_csv_bytes(resultado),
            file_name=f"{base}_transpuesto.csv",
            mime="text/csv",
            use_container_width=True,
        )
elif resultado is not None:
    st.info("El resultado está vacío con la configuración actual. Revisa las opciones.")
