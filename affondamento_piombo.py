import numpy as np
from astropy.constants import g0

VOLUME_BOTTIGLIA = 1.5e-3       # m^3
MASSA_MARE_IN_BOTTIGLIA = 1.59  # Kg

def converti_velocita(v):
    """Converte da nodi a metri al secondo"""
    return v * 0.51444444444444

def ottieni_sollevamento(p, m_p, rho_p, rho_m, eta_m, v):
    """Calcola il sollevamento del piombo dal fondo in metri"""
    N = 6 * np.pi * np.cbrt( 3 * m_p / 4 / np.pi / rho_p ) * eta_m * converti_velocita(v)
    D = m_p * g0.value * ( 1 - rho_m / rho_p )
    atan = np.arctan( N / D )
    return p * ( 1 - np.cos(atan) )


profondita = 20            # metri
massa_piombo = 0.40        # Kg
densita_piombo = 11340     # Kg / m^3
densita_mare = MASSA_MARE_IN_BOTTIGLIA / VOLUME_BOTTIGLIA  # Kg / m^3
viscosita_mare = 1.6e-3    # Kg / m / s  <--- questa stima va migliorata

velocita_traina = 3.5      # nodi -> velocità complessiva misurata col gps: tiene conto anche di eventuale scarroccio
velocita_corrente = 0      # nodi -> può essere negativa se la corrente è opposta alla direzione di traina

velocita_totale = velocita_traina + velocita_corrente

sollevamento = ottieni_sollevamento( 
    profondita,
    massa_piombo,
    densita_piombo,
    densita_mare,
    viscosita_mare,
    velocita_totale
) # metri

print(sollevamento)

