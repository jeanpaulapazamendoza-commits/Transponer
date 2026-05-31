"""
pivot_core.py
=============
Lógica de pivoteo / transposición independiente de la interfaz.

Se mantiene separada de app.py para poder probarla sin levantar Streamlit
y reutilizarla desde notebooks o scripts.

Tres modos:
  1. unpivot_simple        -> melt clásico (ancho a largo)
  2. unpivot_por_grupos    -> melt de varios grupos de columnas emparejadas
                              (ej. P.1/Lt.1, P.2/Lt.2 ...) unidos por una clave
  3. pivot_a_ancho         -> pivot_table (largo a ancho)

Además incluye utilidades de detección automática de patrones de columnas.
"""

from __future__ import annotations

import re
from functools import reduce
from typing import Dict, List, Optional, Sequence

import pandas as pd


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
def limpiar_encabezados(df: pd.DataFrame) -> pd.DataFrame:
    """Convierte los nombres de columna a str y les quita espacios sobrantes."""
    df = df.copy()
    df.columns = df.columns.astype(str).str.strip()
    return df


def detectar_columnas_por_prefijo(df: pd.DataFrame, prefijo: str) -> List[str]:
    """Devuelve las columnas cuyo nombre empieza con `prefijo` (sin distinguir mayúsculas)."""
    p = prefijo.strip().lower()
    return [c for c in df.columns if str(c).strip().lower().startswith(p)]


def detectar_grupos_emparejados(df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Detecta grupos de columnas que comparten un prefijo y terminan en un número.

    Ej.: 'P. 1', 'P. 2'  -> grupo 'P.'    : ['P. 1', 'P. 2']
         'Lt. 1', 'Lt. 2' -> grupo 'Lt.'  : ['Lt. 1', 'Lt. 2']

    Devuelve solo los grupos que tengan al menos 2 columnas.
    """
    grupos: Dict[str, List[str]] = {}
    patron = re.compile(r"^(.*?)[\s_.]*\d+\s*$")
    for c in df.columns:
        m = patron.match(str(c).strip())
        if m:
            base = m.group(1).strip()
            if base:
                grupos.setdefault(base, []).append(c)
    return {base: cols for base, cols in grupos.items() if len(cols) >= 2}


def sugerir_columnas_fijas(df: pd.DataFrame, max_fijas: int = 8) -> List[str]:
    """
    Heurística para sugerir columnas 'fijas' (id_vars): las primeras columnas
    de texto / baja cardinalidad antes de que empiecen las columnas a transponer.
    """
    fijas: List[str] = []
    for c in df.columns:
        serie = df[c]
        es_texto = serie.dtype == object
        baja_cardinalidad = serie.nunique(dropna=True) <= max(50, len(df) // 2)
        if es_texto or baja_cardinalidad:
            fijas.append(c)
        else:
            break
        if len(fijas) >= max_fijas:
            break
    return fijas or list(df.columns[: min(3, len(df.columns))])


# --------------------------------------------------------------------------- #
# Modo 1: unpivot simple (melt)
# --------------------------------------------------------------------------- #
def unpivot_simple(
    df: pd.DataFrame,
    columnas_fijas: Sequence[str],
    columnas_valor: Sequence[str],
    nombre_variable: str = "Variable",
    nombre_valor: str = "Valor",
    quitar_vacios: bool = True,
    quitar_prefijo: Optional[str] = None,
) -> pd.DataFrame:
    """
    Pasa de formato ancho a largo (melt).

    columnas_fijas   : columnas que se conservan (id_vars).
    columnas_valor   : columnas que se transponen a filas (value_vars).
    quitar_vacios    : elimina filas con valor NaN (conserva ceros).
    quitar_prefijo   : si se indica, lo elimina del texto de la columna-variable
                       (ej. 'Suma de ' -> deja solo 'Lunes 2').
    """
    df = limpiar_encabezados(df)
    columnas_fijas = [c for c in columnas_fijas if c in df.columns]
    columnas_valor = [c for c in columnas_valor if c in df.columns]
    if not columnas_valor:
        raise ValueError("Debes seleccionar al menos una columna a transponer.")

    largo = df.melt(
        id_vars=columnas_fijas,
        value_vars=columnas_valor,
        var_name=nombre_variable,
        value_name=nombre_valor,
    )

    if quitar_prefijo:
        largo[nombre_variable] = (
            largo[nombre_variable].astype(str).str.replace(quitar_prefijo, "", regex=False).str.strip()
        )

    if quitar_vacios:
        largo = largo.dropna(subset=[nombre_valor]).reset_index(drop=True)

    return largo


# --------------------------------------------------------------------------- #
# Modo 2: unpivot por grupos emparejados
# --------------------------------------------------------------------------- #
def unpivot_por_grupos(
    df: pd.DataFrame,
    columnas_fijas: Sequence[str],
    grupos: Dict[str, Sequence[str]],
    nombre_clave: str = "Posicion",
    patron_clave: str = r"(\d+)",
    quitar_vacios_en: Optional[str] = None,
    conservar_clave_como_entero: bool = True,
) -> pd.DataFrame:
    """
    Funde varios grupos de columnas emparejadas y los une por una clave común
    extraída del nombre de cada columna.

    Ej. (caso 'esmeralda'):
        grupos = {"Cantidad": ["P. 1","P. 2","P. 3","P. 4"],
                  "Lote":     ["Lt. 1","Lt. 2","Lt. 3","Lt. 4"]}
        -> columnas resultado: columnas_fijas + ['Posicion','Cantidad','Lote']

    nombre_clave   : nombre de la columna que guarda el índice extraído (1,2,3...).
    patron_clave   : regex para extraer la clave del nombre de columna.
    quitar_vacios_en : si se indica un nombre de grupo, elimina las filas donde
                       ese grupo quede NaN (replica el dropna del notebook).
    """
    df = limpiar_encabezados(df)
    columnas_fijas = [c for c in columnas_fijas if c in df.columns]

    # row_id interno garantiza que el merge no genere productos cartesianos
    # cuando las columnas fijas se repiten entre filas.
    df = df.reset_index(drop=True).copy()
    df["__row_id__"] = df.index
    claves_merge = ["__row_id__"] + list(columnas_fijas)

    parciales: List[pd.DataFrame] = []
    for nombre_grupo, cols in grupos.items():
        cols = [c for c in cols if c in df.columns]
        if not cols:
            continue
        m = df.melt(
            id_vars=claves_merge,
            value_vars=cols,
            var_name="__col__",
            value_name=nombre_grupo,
        )
        clave = m["__col__"].astype(str).str.extract(patron_clave)[0]
        m[nombre_clave] = clave
        m = m.drop(columns="__col__")
        parciales.append(m)

    if not parciales:
        raise ValueError("No hay grupos válidos con columnas existentes.")

    resultado = reduce(
        lambda izq, der: pd.merge(izq, der, on=claves_merge + [nombre_clave], how="outer"),
        parciales,
    )

    if quitar_vacios_en and quitar_vacios_en in resultado.columns:
        resultado = resultado.dropna(subset=[quitar_vacios_en])

    if conservar_clave_como_entero:
        resultado[nombre_clave] = pd.to_numeric(resultado[nombre_clave], errors="coerce").astype("Int64")

    resultado = (
        resultado.drop(columns="__row_id__")
        .sort_values(list(columnas_fijas) + [nombre_clave])
        .reset_index(drop=True)
    )
    return resultado


# --------------------------------------------------------------------------- #
# Modo 3: pivot de largo a ancho (pivot_table)
# --------------------------------------------------------------------------- #
def pivot_a_ancho(
    df: pd.DataFrame,
    columnas_indice: Sequence[str],
    columna_a_expandir: str,
    columna_valores: str,
    agregacion: str = "sum",
    rellenar_con=0,
) -> pd.DataFrame:
    """
    Pasa de formato largo a ancho con pandas.pivot_table.

    columnas_indice    : columnas que quedan como filas (index).
    columna_a_expandir : columna cuyos valores se vuelven nuevas columnas.
    columna_valores    : columna numérica a agregar.
    agregacion         : 'sum','mean','count','max','min','first'.
    rellenar_con       : valor para celdas vacías (None para dejar NaN).
    """
    df = limpiar_encabezados(df)
    tabla = pd.pivot_table(
        df,
        index=list(columnas_indice),
        columns=columna_a_expandir,
        values=columna_valores,
        aggfunc=agregacion,
        fill_value=rellenar_con,
    )
    tabla = tabla.reset_index()
    tabla.columns.name = None
    tabla.columns = [str(c) for c in tabla.columns]
    return tabla
