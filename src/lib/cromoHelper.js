/**
 * cromoHelper.js — operaciones puras sobre arrays de cromos del usuario.
 * Formato: [{ cromoId, cantidad, pegado, fechaObtenido }]
 */

/**
 * Añade 1 copia de una carta. Crea la entrada si no existe.
 */
export const anadirCromo = (cromos, cromoId, hoy) => {
  const existing = cromos.find((c) => c.cromoId === cromoId);
  if (existing)
    return cromos.map((c) => c.cromoId === cromoId ? { ...c, cantidad: c.cantidad + 1 } : c);
  return [...cromos, { cromoId, cantidad: 1, fechaObtenido: hoy, pegado: false }];
};

/**
 * Quita 1 copia de una carta. Elimina la entrada si cantidad llega a 0.
 */
export const quitarCromo = (cromos, cromoId) =>
  cromos
    .map((c) => c.cromoId === cromoId ? { ...c, cantidad: c.cantidad - 1 } : c)
    .filter((c) => c.cantidad > 0);

/**
 * Quema una carta pegada en el álbum (usada en ruleta).
 * - Si tenía 1: desaparece del inventario.
 * - Si tenía >1: reduce 1 y la despega (pegado: false).
 * @returns {{ cromosActualizados, quemada: boolean }}
 */
export const quemarCartaPegada = (cromos, cromoId) => {
  const entry = cromos.find((c) => c.cromoId === cromoId);
  if (!entry) return { cromosActualizados: cromos, quemada: false };

  const cromosActualizados = cromos
    .map((c) => {
      if (c.cromoId !== cromoId) return c;
      if (c.cantidad <= 1) return null; // desaparece
      return { ...c, cantidad: c.cantidad - 1, pegado: false };
    })
    .filter(Boolean);

  return { cromosActualizados, quemada: true };
};

/**
 * Merges los cromos de un sobre abierto en el inventario del usuario.
 * nuevos: array de objetos del catálogo con { id }
 * @returns {{ cromosActualizados, nuevosCount, repetidosCount }}
 */
export const mergeCromosConSobre = (cromosActuales, nuevos, hoy) => {
  const cromosActualizados = [...cromosActuales];
  let nuevosCount = 0;
  let repetidosCount = 0;

  nuevos.forEach((cromo) => {
    const existing = cromosActualizados.find((c) => c.cromoId === cromo.id);
    if (existing) {
      existing.cantidad += 1;
      repetidosCount++;
    } else {
      cromosActualizados.push({ cromoId: cromo.id, cantidad: 1, fechaObtenido: hoy, pegado: false });
      nuevosCount++;
    }
  });

  return { cromosActualizados, nuevosCount, repetidosCount };
};

/**
 * Selecciona una carta aleatoria de una rareza concreta del inventario de un jugador.
 * catalogo: array de { id, rareza }
 * @returns {entry | null}
 */
export const elegirCartaAleatoria = (userCromos, rareza, catalogo, randomFn = Math.random) => {
  const disponibles = userCromos.filter((c) => {
    const info = catalogo.find((x) => x.id === c.cromoId);
    return info?.rareza === rareza && c.cantidad > 0;
  });
  if (disponibles.length === 0) return null;
  return disponibles[Math.floor(randomFn() * disponibles.length)];
};

/**
 * Filtra jugadores que tienen al menos 1 carta de la rareza indicada.
 */
export const filtrarJugadoresConRareza = (jugadores, rareza, catalogo) =>
  jugadores.filter((j) =>
    (j.cromos || []).some((c) => {
      const info = catalogo.find((x) => x.id === c.cromoId);
      return info?.rareza === rareza && c.cantidad > 0;
    })
  );

/**
 * Elige una carta pegada al azar para quemar (ruleta "quema").
 * @returns {entry | null}
 */
export const elegirCartaPegadaAleatoria = (userCromos, randomFn = Math.random) => {
  const pegadas = userCromos.filter((c) => c.pegado !== false && c.cantidad > 0);
  if (pegadas.length === 0) return null;
  return pegadas[Math.floor(randomFn() * pegadas.length)];
};
