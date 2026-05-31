"""
Pivoteador Universal — Streamlit
================================
App para transponer / pivotear cualquier archivo Excel o CSV de forma
configurable, sin tocar código.

Modos:
  1. Unpivot simple (melt): columnas fijas + columnas a transponer -> formato largo.
  2. Unpivot por pares/grupos: columnas emparejadas (P.1/Lt.1, P.2/Lt.2...) -> largo.
  3. Pivot largo->ancho: agrupar filas y expandir una columna en varias.

Ejecutar localmente:   streamlit run app.py
Desplegar:             ver README.md (Streamlit Community Cloud + GitHub)
"""

import io
import re

import pandas as pd
import streamlit as st

from pivot_core import (
    detectar_columnas_por_prefijo,
    detectar_grupos_emparejados,
    limpiar_encabezados,
    pivot_a_ancho,
    sugerir_columnas_fijas,
    unpivot_por_grupos,
    unpivot_simple,
)

# --------------------------------------------------------------------------- #
# Configuración general
# --------------------------------------------------------------------------- #
st.set_page_config(page_title="Pivoteador Universal", page_icon="🔄", layout="wide")

st.title("🔄 Pivoteador Universal")
st.caption(
    "Transpone o pivotea cualquier Excel/CSV. Configura tu pivoteo, "
    "previsualiza el resultado y descarga el archivo listo."
)


# --------------------------------------------------------------------------- #
# Helpers de lectura / escritura
# --------------------------------------------------------------------------- #
@st.cache_data(show_spinner=False)
def listar_hojas(contenido: bytes) -> list[str]:
    """Lista las hojas de un Excel a partir de sus bytes."""
    return pd.ExcelFile(io.BytesIO(contenido)).sheet_names


@st.cache_data(show_spinner=False)
def leer_datos(contenido: bytes, nombre: str, hoja, fila_encabezado: int) -> pd.DataFrame:
    """Lee un archivo (csv/xlsx) a DataFrame según extensión."""
    if nombre.lower().endswith(".csv"):
        # Intenta separadores comunes automáticamente
        try:
            df = pd.read_csv(io.BytesIO(contenido), header=fila_encabezado, sep=None, engine="python")
        except Exception:
            df = pd.read_csv(io.BytesIO(contenido), header=fila_encabezado)
    else:
        df = pd.read_excel(io.BytesIO(contenido), sheet_name=hoja, header=fila_encabezado)
    return limpiar_encabezados(df)


def a_excel_bytes(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Pivoteado")
    return buf.getvalue()


def a_csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8-sig")


# --------------------------------------------------------------------------- #
# 1) Carga del archivo
# --------------------------------------------------------------------------- #
st.header("1 · Carga tu archivo")

archivo = st.file_uploader(
    "Arrastra o selecciona un archivo Excel (.xlsx, .xls) o CSV (.csv)",
    type=["xlsx", "xls", "csv"],
)

if archivo is None:
    st.info(
        "Sube un archivo para empezar. La app detectará automáticamente patrones "
        "de columnas (por ejemplo 'Suma de…' o pares 'P.1 / Lt.1')."
    )
    st.stop()

contenido = archivo.getvalue()
es_excel = not archivo.name.lower().endswith(".csv")

col_a, col_b = st.columns(2)
hoja_sel = 0
with col_a:
    if es_excel:
        hojas = listar_hojas(contenido)
        hoja_sel = st.selectbox("Hoja de Excel", hojas, index=0)
with col_b:
    fila_encabezado = st.number_input(
        "Fila de encabezado (0 = primera fila)", min_value=0, max_value=50, value=0, step=1
    )

try:
    df = leer_datos(contenido, archivo.name, hoja_sel, int(fila_encabezado))
except Exception as e:  # noqa: BLE001
    st.error(f"No se pudo leer el archivo: {e}")
    st.stop()

st.success(f"Archivo leído: **{df.shape[0]} filas × {df.shape[1]} columnas**")
with st.expander("Ver datos originales (primeras 50 filas)", expanded=False):
    st.dataframe(df.head(50), use_container_width=True)

columnas = list(df.columns)


# --------------------------------------------------------------------------- #
# 2) Modo de pivoteo
# --------------------------------------------------------------------------- #
st.header("2 · Elige el modo de pivoteo")

modo = st.radio(
    "Modo",
    [
        "Unpivot simple (columnas → filas)",
        "Unpivot por pares/grupos (P.1/Lt.1 …)",
        "Pivot largo → ancho (filas → columnas)",
    ],
    captions=[
        "Una sola familia de columnas. Caso 'distribuccion'.",
        "Varios grupos emparejados unidos por posición. Caso 'esmeralda'.",
        "Lo inverso: agrupa filas y expande una columna (pivot_table).",
    ],
)

resultado = None
nombre_base = re.sub(r"\.[^.]+$", "", archivo.name)


# =========================================================================== #
# MODO 1 — Unpivot simple
# =========================================================================== #
if modo.startswith("Unpivot simple"):
    st.subheader("Configuración · Unpivot simple")

    fijas_sugeridas = sugerir_columnas_fijas(df)
    suma_de = detectar_columnas_por_prefijo(df, "Suma de")

    c1, c2 = st.columns(2)
    with c1:
        columnas_fijas = st.multiselect(
            "Columnas fijas (se conservan)", columnas, default=fijas_sugeridas
        )
    with c2:
        restantes = [c for c in columnas if c not in columnas_fijas]
        default_valor = suma_de if suma_de else restantes
        default_valor = [c for c in default_valor if c in restantes]
        columnas_valor = st.multiselect(
            "Columnas a transponer (van a filas)", restantes, default=default_valor
        )

    c3, c4, c5 = st.columns(3)
    with c3:
        nombre_variable = st.text_input("Nombre col. variable", value="Dia")
    with c4:
        nombre_valor = st.text_input("Nombre col. valor", value="Qty")
    with c5:
        quitar_prefijo = st.text_input("Quitar prefijo del nombre (opcional)", value="Suma de ")

    quitar_vacios = st.checkbox("Quitar filas vacías (conserva ceros)", value=True)

    if st.button("⚙️ Generar pivoteo", type="primary"):
        try:
            resultado = unpivot_simple(
                df,
                columnas_fijas=columnas_fijas,
                columnas_valor=columnas_valor,
                nombre_variable=nombre_variable.strip() or "Variable",
                nombre_valor=nombre_valor.strip() or "Valor",
                quitar_vacios=quitar_vacios,
                quitar_prefijo=quitar_prefijo.strip() or None,
            )
        except Exception as e:  # noqa: BLE001
            st.error(f"Error al pivotear: {e}")


# =========================================================================== #
# MODO 2 — Unpivot por pares/grupos
# =========================================================================== #
elif modo.startswith("Unpivot por pares"):
    st.subheader("Configuración · Unpivot por pares/grupos")

    grupos_auto = detectar_grupos_emparejados(df)
    cols_en_grupos = {c for cols in grupos_auto.values() for c in cols}
    fijas_sugeridas = [c for c in sugerir_columnas_fijas(df) if c not in cols_en_grupos]

    columnas_fijas = st.multiselect(
        "Columnas fijas (se conservan)", columnas, default=fijas_sugeridas
    )

    st.markdown("**Grupos de columnas a fundir** (cada grupo será una columna de salida)")
    if grupos_auto:
        st.caption(
            "Detectados automáticamente: "
            + ", ".join(f"`{b}` ({len(c)})" for b, c in grupos_auto.items())
        )

    n_grupos = st.number_input(
        "¿Cuántos grupos?", min_value=1, max_value=10,
        value=max(1, len(grupos_auto)), step=1,
    )

    bases_auto = list(grupos_auto.items())
    nombres_salida_sugeridos = {"P": "Cantidad", "P.": "Cantidad", "Lt": "Lote", "Lt.": "Lote"}

    grupos: dict[str, list[str]] = {}
    disponibles = [c for c in columnas if c not in columnas_fijas]
    for i in range(int(n_grupos)):
        with st.container(border=True):
            base, cols_def = (bases_auto[i] if i < len(bases_auto) else ("", []))
            nombre_def = nombres_salida_sugeridos.get(base.strip().rstrip("."), base or f"Grupo{i+1}")
            cc1, cc2 = st.columns([1, 3])
            with cc1:
                nombre_grupo = st.text_input(
                    f"Nombre salida #{i+1}", value=nombre_def, key=f"grp_nombre_{i}"
                )
            with cc2:
                cols_grupo = st.multiselect(
                    f"Columnas del grupo #{i+1}", disponibles,
                    default=[c for c in cols_def if c in disponibles], key=f"grp_cols_{i}",
                )
            if nombre_grupo.strip() and cols_grupo:
                grupos[nombre_grupo.strip()] = cols_grupo

    c1, c2, c3 = st.columns(3)
    with c1:
        nombre_clave = st.text_input("Nombre col. de posición", value="Posicion")
    with c2:
        patron_clave = st.text_input("Regex para extraer la clave", value=r"(\d+)")
    with c3:
        quitar_vacios_en = st.selectbox(
            "Quitar filas vacías según grupo",
            ["(ninguno)"] + list(grupos.keys()),
            index=1 if grupos else 0,
        )

    if st.button("⚙️ Generar pivoteo", type="primary"):
        try:
            resultado = unpivot_por_grupos(
                df,
                columnas_fijas=columnas_fijas,
                grupos=grupos,
                nombre_clave=nombre_clave.strip() or "Posicion",
                patron_clave=patron_clave or r"(\d+)",
                quitar_vacios_en=None if quitar_vacios_en == "(ninguno)" else quitar_vacios_en,
            )
        except Exception as e:  # noqa: BLE001
            st.error(f"Error al pivotear: {e}")


# =========================================================================== #
# MODO 3 — Pivot largo → ancho
# =========================================================================== #
else:
    st.subheader("Configuración · Pivot largo → ancho")

    c1, c2 = st.columns(2)
    with c1:
        columnas_indice = st.multiselect(
            "Columnas índice (quedan como filas)",
            columnas,
            default=columnas[: min(2, len(columnas))],
        )
        columna_a_expandir = st.selectbox(
            "Columna a expandir (se vuelve columnas)",
            columnas,
            index=min(len(columnas) - 1, max(0, len(columnas) - 2)),
        )
    with c2:
        columna_valores = st.selectbox(
            "Columna de valores (a agregar)", columnas, index=len(columnas) - 1
        )
        agregacion = st.selectbox(
            "Agregación", ["sum", "mean", "count", "max", "min", "first"], index=0
        )

    rellenar = st.checkbox("Rellenar celdas vacías con 0", value=True)

    if st.button("⚙️ Generar pivoteo", type="primary"):
        try:
            resultado = pivot_a_ancho(
                df,
                columnas_indice=columnas_indice,
                columna_a_expandir=columna_a_expandir,
                columna_valores=columna_valores,
                agregacion=agregacion,
                rellenar_con=0 if rellenar else None,
            )
        except Exception as e:  # noqa: BLE001
            st.error(f"Error al pivotear: {e}")


# --------------------------------------------------------------------------- #
# 3) Resultado y descarga
# --------------------------------------------------------------------------- #
if resultado is not None:
    st.header("3 · Resultado")
    st.success(f"Resultado: **{resultado.shape[0]} filas × {resultado.shape[1]} columnas**")
    st.dataframe(resultado.head(200), use_container_width=True)

    st.subheader("Descargar")
    formato = st.radio("Formato de salida", ["Excel (.xlsx)", "CSV (.csv)"], horizontal=True)
    if formato.startswith("Excel"):
        st.download_button(
            "⬇️ Descargar Excel",
            data=a_excel_bytes(resultado),
            file_name=f"{nombre_base}_pivoteado.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary",
        )
    else:
        st.download_button(
            "⬇️ Descargar CSV",
            data=a_csv_bytes(resultado),
            file_name=f"{nombre_base}_pivoteado.csv",
            mime="text/csv",
            type="primary",
        )

st.divider()
st.caption("Hecho con Streamlit · Pivoteador Universal")
