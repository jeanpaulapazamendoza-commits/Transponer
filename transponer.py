"""
Lógica de transposición (de formato ancho a formato largo).

Soporta dos modos:
  1. SIMPLE  -> varias columnas con un mismo concepto se apilan en una sola
               columna de valor. Ej: "Suma de Lunes", "Suma de Martes" -> una
               columna "Dia" + una columna "Valor".
  2. EMPAREJADO -> grupos de columnas relacionadas por posición se despivotan
               manteniendo la relación. Ej: ("P. 1","Lt. 1"), ("P. 2","Lt. 2")
               -> una columna "Posicion" + "P." + "Lt.".

El módulo no depende de Streamlit para poder probarse de forma aislada.
"""

import re
import pandas as pd


def detectar_grupos_emparejados(columnas):
    """
    Detecta grupos de columnas que comparten un mismo número final.

    Devuelve un dict: {prefijo_normalizado: {numero: nombre_columna_original}}
    Solo conserva los prefijos que aparecen en MÁS de un número distinto
    (de lo contrario no hay nada que "apilar").
    """
    patron = re.compile(r"^(.*?)[\s._-]*(\d+)\s*$")
    grupos = {}
    for col in columnas:
        m = patron.match(str(col))
        if not m:
            continue
        prefijo = m.group(1).strip().rstrip(".").strip()
        numero = int(m.group(2))
        if not prefijo:
            continue
        grupos.setdefault(prefijo, {})[numero] = col

    # Solo grupos con al menos 2 posiciones distintas
    return {p: d for p, d in grupos.items() if len(d) >= 2}


def detectar_prefijo_texto(columnas, min_cols=2):
    """
    Detecta un conjunto de columnas que comparten un mismo prefijo de texto
    (las 2+ primeras palabras), típico de tablas dinámicas exportadas:
    "Suma de Lunes", "Suma de Martes", ... -> prefijo "Suma de".

    Devuelve (prefijo, [columnas]) o (None, []) si no hay un grupo dominante.
    """
    grupos = {}
    for col in columnas:
        palabras = str(col).split()
        if len(palabras) >= 3:
            clave = " ".join(palabras[:2])  # ej: "Suma de"
            grupos.setdefault(clave, []).append(col)

    if not grupos:
        return None, []
    prefijo, cols = max(grupos.items(), key=lambda kv: len(kv[1]))
    if len(cols) >= min_cols:
        return prefijo, cols
    return None, []


def sugerir_configuracion(df):
    """
    Analiza el DataFrame y propone:
      - modo ("emparejado" | "simple")
      - columnas_fijas sugeridas
      - columnas_a_transponer / grupos según el modo
    """
    columnas = list(df.columns)
    grupos = detectar_grupos_emparejados(columnas)

    # Prioridad 1: grupo por prefijo de texto repetido (ej: "Suma de ...")
    prefijo_txt, cols_txt = detectar_prefijo_texto(columnas)
    if prefijo_txt and len(grupos) < 2:
        columnas_fijas = [c for c in columnas if c not in cols_txt]
        return {
            "modo": "simple",
            "columnas_fijas": columnas_fijas,
            "columnas_a_transponer": cols_txt,
        }

    if len(grupos) >= 2:
        # Caso tipo esmeralda: varios prefijos comparten las mismas posiciones
        cols_en_grupos = {c for d in grupos.values() for c in d.values()}
        columnas_fijas = [c for c in columnas if c not in cols_en_grupos]
        return {
            "modo": "emparejado",
            "columnas_fijas": columnas_fijas,
            "grupos": grupos,
        }

    if len(grupos) == 1:
        # Un solo prefijo repetido (ej: "Suma de ..."): modo simple
        (_, d), = grupos.items()
        cols_grupo = list(d.values())
        columnas_fijas = [c for c in columnas if c not in cols_grupo]
        return {
            "modo": "simple",
            "columnas_fijas": columnas_fijas,
            "columnas_a_transponer": cols_grupo,
        }

    # Sin patrón claro: heurística -> columnas numéricas se transponen,
    # el resto quedan fijas.
    numericas = [c for c in columnas if pd.api.types.is_numeric_dtype(df[c])]
    no_numericas = [c for c in columnas if c not in numericas]
    if numericas and no_numericas:
        return {
            "modo": "simple",
            "columnas_fijas": no_numericas,
            "columnas_a_transponer": numericas,
        }

    # Último recurso: primera columna fija, el resto se transpone
    return {
        "modo": "simple",
        "columnas_fijas": columnas[:1],
        "columnas_a_transponer": columnas[1:],
    }


def transponer_simple(df, columnas_fijas, columnas_a_transponer,
                       nombre_categoria="Variable", nombre_valor="Valor",
                       conservar_vacios=False):
    """Apila varias columnas en una sola (melt clásico)."""
    largo = df.melt(
        id_vars=columnas_fijas,
        value_vars=columnas_a_transponer,
        var_name=nombre_categoria,
        value_name=nombre_valor,
    )
    if not conservar_vacios:
        largo = largo.dropna(subset=[nombre_valor])
    return largo.reset_index(drop=True)


def transponer_emparejado(df, columnas_fijas, grupos,
                          nombre_posicion="Posicion",
                          conservar_vacios=False):
    """
    Despivota grupos de columnas emparejadas por posición.

    grupos: {prefijo: {numero: nombre_columna}}
    El resultado tiene las columnas fijas + 'Posicion' + una columna por prefijo.
    """
    df = df.copy()
    df["__row_id__"] = range(len(df))
    id_vars = ["__row_id__"] + list(columnas_fijas)

    parciales = []
    for prefijo, mapping in grupos.items():
        value_vars = list(mapping.values())
        parcial = df.melt(
            id_vars=id_vars,
            value_vars=value_vars,
            var_name="__col__",
            value_name=prefijo,
        )
        # Extraer el número de posición del nombre de columna original
        parcial[nombre_posicion] = (
            parcial["__col__"].astype(str).str.extract(r"(\d+)").astype(int)
        )
        parcial = parcial.drop(columns="__col__")
        parciales.append(parcial)

    # Unir todos los prefijos por (row_id + fijas + posicion)
    claves = id_vars + [nombre_posicion]

    # Normalizar las columnas fijas a texto para evitar el error de "tipos
    # mixtos" al ordenar durante el merge (numpy no puede ordenar una columna
    # que mezcla números y texto). __row_id__ y la posición ya son enteros
    # homogéneos, así que no hace falta tocarlos.
    claves_a_normalizar = list(columnas_fijas)
    for parcial in parciales:
        for col in claves_a_normalizar:
            parcial[col] = parcial[col].astype("string")

    resultado = parciales[0]
    for parcial in parciales[1:]:
        resultado = resultado.merge(parcial, on=claves, how="outer")

    columnas_valor = list(grupos.keys())
    if not conservar_vacios:
        resultado = resultado.dropna(subset=columnas_valor, how="all")

    resultado = (
        resultado.sort_values(["__row_id__", nombre_posicion])
        .drop(columns="__row_id__")
        .reset_index(drop=True)
    )
    # Ordenar columnas: fijas + posicion + valores
    orden = list(columnas_fijas) + [nombre_posicion] + columnas_valor
    return resultado[orden]
