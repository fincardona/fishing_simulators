import numpy as np
from astropy.constants import g0

def nodi_a_ms(v):
    return v * 0.51444444444444

def raggio_sfera_da_massa(massa, densita):
    return np.cbrt(3 * massa / (4 * np.pi * densita))

def drag_quadratico(massa, densita_piombo, densita_acqua, cd, velocita_ms):
    r = raggio_sfera_da_massa(massa, densita_piombo)
    area = np.pi * r**2
    return 0.5 * densita_acqua * cd * area * velocita_ms**2

def peso_apparente(massa, densita_piombo, densita_acqua):
    return massa * g0.value * (1 - densita_acqua / densita_piombo)

def sollevamento_piombo(profondita, massa, densita_piombo, densita_acqua, cd, velocita_nodi):
    v = nodi_a_ms(velocita_nodi)

    f_drag = drag_quadratico(
        massa,
        densita_piombo,
        densita_acqua,
        cd,
        v
    )

    f_verticale = peso_apparente(
        massa,
        densita_piombo,
        densita_acqua
    )

    theta = np.arctan(f_drag / f_verticale)

    return profondita * (1 - np.cos(theta)), theta, f_drag, f_verticale