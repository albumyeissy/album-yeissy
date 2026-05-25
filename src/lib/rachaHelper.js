/**
 * rachaHelper.js — lógica pura de rachas, sin Firebase ni React.
 * Todas las funciones son deterministas y fácilmente testeables.
 */

/** Devuelve la fecha local de hoy como YYYY-MM-DD */
export const getHoy = () => new Date().toLocaleDateString("en-CA");

/** Devuelve la fecha local de ayer como YYYY-MM-DD */
export const getAyer = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
};

/**
 * Calcula el resultado de abrir el primer sobre del día.
 *
 * @param {string} fechaUltima        - datosUsuario.fechaUltimaApertura ('' si nunca abrió)
 * @param {number} rachaActual        - racha actual del usuario
 * @param {string|null} rachaProtegida - datosUsuario.rachaProtegidaFecha (null/undefined si no tiene)
 * @param {string} hoy                - fecha de hoy YYYY-MM-DD
 * @param {string} ayer               - fecha de ayer YYYY-MM-DD
 * @returns {{ nuevaRacha: number, consumirProteccion: boolean, esPrimerSobreDelDia: boolean }}
 */
export const calcularRacha = (fechaUltima, rachaActual, rachaProtegida, hoy, ayer) => {
  // Ya abrió hoy: no procesar racha otra vez
  if (fechaUltima === hoy) {
    return { nuevaRacha: rachaActual, consumirProteccion: false, esPrimerSobreDelDia: false };
  }

  const protegida = rachaProtegida === hoy;

  let nuevaRacha;
  let consumirProteccion = false;

  if (protegida) {
    // Protección activa: conserva racha sin importar cuánto tiempo pasó
    nuevaRacha = rachaActual;
    consumirProteccion = true;
  } else if (fechaUltima === ayer) {
    // Día consecutivo: continúa racha
    nuevaRacha = rachaActual + 1;
  } else {
    // Faltó un día o más: reset
    nuevaRacha = 1;
  }

  return { nuevaRacha, consumirProteccion, esPrimerSobreDelDia: true };
};

/**
 * Calcula si se gana un sobre bonus por racha múltiplo de 5.
 * @param {number} nuevaRacha
 * @param {number} sobresBonus actuales
 * @returns {number} nuevo total de sobresBonus
 */
export const calcularBonusRacha = (nuevaRacha, sobresBonus) => {
  if (nuevaRacha > 0 && nuevaRacha % 5 === 0) return sobresBonus + 1;
  return sobresBonus;
};

/**
 * Decide si el usuario puede abrir un sobre en este momento.
 * @param {number} sobresHoy abiertos hoy
 * @param {number} maxSobres límite diario (1 si maldecido, 2 normal)
 * @param {number} sobresBonus
 * @param {number} sobresRuleta
 */
export const puedeAbrirSobre = (sobresHoy, maxSobres, sobresBonus, sobresRuleta) => {
  return sobresHoy < maxSobres || sobresBonus > 0 || sobresRuleta > 0;
};

/**
 * Calcula el máximo de sobres diarios según maldición.
 * @param {string|null} fechaMaldicion
 * @param {string} hoy
 * @param {number} maxNormal
 */
export const calcularMaxSobres = (fechaMaldicion, hoy, maxNormal = 2) => {
  return fechaMaldicion === hoy ? 1 : maxNormal;
};

/**
 * Calcula qué tipo de sobre se va a usar (normal, bonus o ruleta).
 * @returns {"normal"|"bonus"|"ruleta"}
 */
export const tipoSobre = (sobresHoy, maxSobres, sobresBonus, sobresRuleta) => {
  if (sobresHoy < maxSobres) return "normal";
  if (sobresBonus > 0) return "bonus";
  if (sobresRuleta > 0) return "ruleta";
  return "normal"; // no debería llegar aquí si puedeAbrirSobre === true
};
