"""Comunas de Chile (346) con su región, para llenar el formulario de boletas del SII.

El robot elige región y comuna en desplegables, así que necesita el texto exacto de cada opción.
Por ahora se asume que es el nombre oficial; lo que la prueba real muestre distinto va en
NOMBRES_SII_REGION y NOMBRES_SII_COMUNA, sin tocar las listas.
"""

import re
import unicodedata
from dataclasses import dataclass

REGIONES = {
    "XV": "Arica y Parinacota",
    "I": "Tarapacá",
    "II": "Antofagasta",
    "III": "Atacama",
    "IV": "Coquimbo",
    "V": "Valparaíso",
    "XIII": "Metropolitana de Santiago",
    "VI": "Libertador General Bernardo O'Higgins",
    "VII": "Maule",
    "XVI": "Ñuble",
    "VIII": "Biobío",
    "IX": "La Araucanía",
    "XIV": "Los Ríos",
    "X": "Los Lagos",
    "XI": "Aysén del General Carlos Ibáñez del Campo",
    "XII": "Magallanes y de la Antártica Chilena",
}

COMUNAS = {
    "XV": ("Arica", "Camarones", "Putre", "General Lagos"),
    "I": ("Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"),
    "II": (
        "Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe",
        "San Pedro de Atacama", "Tocopilla", "María Elena",
    ),
    "III": (
        "Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar",
        "Alto del Carmen", "Freirina", "Huasco",
    ),
    "IV": (
        "La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paiguano", "Vicuña", "Illapel", "Canela",
        "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado",
    ),
    "V": (
        "Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar",
        "Isla de Pascua", "Los Andes", "Calle Larga", "Rinconada", "San Esteban", "La Ligua", "Cabildo",
        "Papudo", "Petorca", "Zapallar", "Quillota", "Calera", "Hijuelas", "La Cruz", "Nogales",
        "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo", "San Felipe",
        "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María", "Quilpué", "Limache", "Olmué",
        "Villa Alemana",
    ),
    "XIII": (
        "Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba",
        "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes",
        "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda",
        "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca",
        "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo",
        "Colina", "Lampa", "Tiltil", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla",
        "Alhué", "Curacaví", "María Pinto", "San Pedro", "Talagante", "El Monte", "Isla de Maipo",
        "Padre Hurtado", "Peñaflor",
    ),
    "VI": (
        "Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Las Cabras", "Machalí",
        "Malloa", "Mostazal", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco", "Rengo", "Requínoa",
        "San Vicente", "Pichilemu", "La Estrella", "Litueche", "Marchigüe", "Navidad", "Paredones",
        "San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo", "Placilla",
        "Pumanque", "Santa Cruz",
    ),
    "VII": (
        "Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro",
        "San Clemente", "San Rafael", "Cauquenes", "Chanco", "Pelluhue", "Curicó", "Hualañé", "Licantén",
        "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén", "Linares", "Colbún",
        "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas",
    ),
    "XVI": (
        "Chillán", "Bulnes", "Chillán Viejo", "El Carmen", "Pemuco", "Pinto", "Quillón", "San Ignacio",
        "Yungay", "Quirihue", "Cobquecura", "Coelemu", "Ninhue", "Portezuelo", "Ránquil", "Treguaco",
        "San Carlos", "Coihueco", "Ñiquén", "San Fabián", "San Nicolás",
    ),
    "VIII": (
        "Concepción", "Coronel", "Chiguayante", "Florida", "Hualqui", "Lota", "Penco", "San Pedro de la Paz",
        "Santa Juana", "Talcahuano", "Tomé", "Hualpén", "Lebu", "Arauco", "Cañete", "Contulmo",
        "Curanilahue", "Los Álamos", "Tirúa", "Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén",
        "Nacimiento", "Negrete", "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel",
        "Alto Biobío",
    ),
    "IX": (
        "Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche",
        "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra",
        "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol", "Angol", "Collipulli",
        "Curacautín", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico", "Traiguén",
        "Victoria",
    ),
    "XIV": (
        "Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli",
        "La Unión", "Futrono", "Lago Ranco", "Río Bueno",
    ),
    "X": (
        "Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín",
        "Puerto Varas", "Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén",
        "Quellón", "Quemchi", "Quinchao", "Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro",
        "San Juan de la Costa", "San Pablo", "Chaitén", "Futaleufú", "Hualaihué", "Palena",
    ),
    "XI": (
        "Coyhaique", "Lago Verde", "Aysén", "Cisnes", "Guaitecas", "Cochrane", "O'Higgins", "Tortel",
        "Chile Chico", "Río Ibáñez",
    ),
    "XII": (
        "Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Cabo de Hornos", "Antártica",
        "Porvenir", "Primavera", "Timaukel", "Natales", "Torres del Paine",
    ),
}

# Texto de la opción en los desplegables del SII cuando no es el nombre oficial. Se completa
# con la prueba real.
NOMBRES_SII_REGION = {}
NOMBRES_SII_COMUNA = {}

# Otras formas comunes de escribir una comuna (ya normalizadas).
ALIAS = {
    "lacalera": "Calera",
    "sanfranciscodemostazal": "Mostazal",
    "coihaique": "Coyhaique",
    "aisen": "Aysén",
    "puertoaysen": "Aysén",
    "puertonatales": "Natales",
    "marchihue": "Marchigüe",
    "paihuano": "Paiguano",
    "trehuaco": "Treguaco",
    "santiagocentro": "Santiago",
    "rapanui": "Isla de Pascua",
}


@dataclass(frozen=True)
class Comuna:
    nombre: str
    nombre_sii: str
    region: str
    region_sii: str


def normalizar(texto):
    sin_tildes = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", sin_tildes.lower())


_POR_CLAVE = {}
for _codigo, _nombres in COMUNAS.items():
    for _nombre in _nombres:
        _POR_CLAVE[normalizar(_nombre)] = Comuna(
            nombre=_nombre,
            nombre_sii=NOMBRES_SII_COMUNA.get(_nombre, _nombre),
            region=REGIONES[_codigo],
            region_sii=NOMBRES_SII_REGION.get(_codigo, REGIONES[_codigo]),
        )


def buscar_comuna(texto):
    """La comuna escrita libremente ("nunoa", "Ñuñoa", "Til Til"), o None si no se reconoce."""
    clave = normalizar(texto)
    if clave in ALIAS:
        clave = normalizar(ALIAS[clave])
    return _POR_CLAVE.get(clave)
