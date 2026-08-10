const pool = require('../config/db');

/**
 * =========================================================
 * OBTENER NOTIFICACIONES DE PAGOS
 * =========================================================
 *
 * Devuelve:
 *
 * 1. Cuotas vencidas:
 *    fecha_vencimiento < CURRENT_DATE
 *    saldo_pendiente > 0
 *
 * 2. Cuotas próximas a vencer:
 *    fecha_vencimiento >= CURRENT_DATE
 *    fecha_vencimiento <= CURRENT_DATE + 5 días
 *    saldo_pendiente > 0
 *
 * =========================================================
 */
async function obtenerNotificacionesPagos() {

  const result = await pool.query(`
    WITH cuotas_pendientes AS (

      SELECT
        c.id AS cuota_id,

        c.plan_pago_alumno_id,

        c.numero_cuota,

        c.fecha_programada,

        c.fecha_vencimiento,

        c.monto_programado,

        c.monto_pagado,

        c.saldo_pendiente,

        c.estado AS cuota_estado,

        c.observaciones AS cuota_observaciones,

        cc.codigo AS concepto_codigo,

        cc.nombre AS concepto_nombre,

        ppa.matricula_id,

        ppa.modalidad_pago,

        m.alumno_id,

        m.fecha_matricula,

        m.fecha_inicio,

        m.fecha_fin_estimada,

        a.dni,

        a.nombres,

        a.apellidos,

        a.telefono,

        a.correo

      FROM cuotas c

      INNER JOIN planes_pago_alumno ppa
        ON ppa.id = c.plan_pago_alumno_id

      INNER JOIN matriculas m
        ON m.id = ppa.matricula_id

      INNER JOIN alumnos a
        ON a.id = m.alumno_id

      INNER JOIN conceptos_cobro cc
        ON cc.id = c.concepto_id

      WHERE
        COALESCE(c.saldo_pendiente, 0) > 0

        AND COALESCE(c.estado, '') NOT IN (
          'PAGADO',
          'ANULADO',
          'CANCELADO'
        )

        AND m.activo = TRUE
    )

    SELECT
      *,

      CASE

        WHEN fecha_vencimiento < CURRENT_DATE
        THEN 'VENCIDA'

        WHEN fecha_vencimiento >= CURRENT_DATE
          AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '5 days'
        THEN 'POR_VENCER'

        ELSE NULL

      END AS tipo_notificacion,

      CASE

        WHEN fecha_vencimiento < CURRENT_DATE
        THEN CURRENT_DATE - fecha_vencimiento

        ELSE 0

      END AS dias_vencida,

      CASE

        WHEN fecha_vencimiento >= CURRENT_DATE
        THEN fecha_vencimiento - CURRENT_DATE

        ELSE 0

      END AS dias_restantes

    FROM cuotas_pendientes

    WHERE

      fecha_vencimiento < CURRENT_DATE

      OR (

        fecha_vencimiento >= CURRENT_DATE

        AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '5 days'

      )

    ORDER BY

      CASE

        WHEN fecha_vencimiento < CURRENT_DATE
        THEN 0

        ELSE 1

      END,

      fecha_vencimiento ASC,

      apellidos ASC,

      nombres ASC
  `);

  const filas = result.rows;

  const vencidas = filas.filter(
    item => item.tipo_notificacion === 'VENCIDA'
  );

  const porVencer = filas.filter(
    item => item.tipo_notificacion === 'POR_VENCER'
  );

  /**
   * =========================================================
   * CANTIDAD DE ALUMNOS ÚNICOS
   * =========================================================
   *
   * Una persona puede tener varias cuotas.
   * Por eso no usamos simplemente filas.length.
   */
  const alumnosIds = new Set(
    filas.map(item => Number(item.alumno_id))
  );

  const alumnosVencidosIds = new Set(
    vencidas.map(item => Number(item.alumno_id))
  );

  const alumnosPorVencerIds = new Set(
    porVencer.map(item => Number(item.alumno_id))
  );

  return {

    /**
     * Cantidad total de cuotas notificables
     */
    cantidad: filas.length,

    /**
     * Cantidad de alumnos únicos
     */
    cantidad_alumnos: alumnosIds.size,

    /**
     * Cantidad de cuotas vencidas
     */
    cantidad_vencidas: vencidas.length,

    /**
     * Cantidad de alumnos con cuotas vencidas
     */
    cantidad_alumnos_vencidos:
      alumnosVencidosIds.size,

    /**
     * Cantidad de cuotas próximas a vencer
     */
    cantidad_por_vencer:
      porVencer.length,

    /**
     * Cantidad de alumnos con cuotas próximas
     */
    cantidad_alumnos_por_vencer:
      alumnosPorVencerIds.size,

    /**
     * Cuotas vencidas
     */
    vencidas,

    /**
     * Cuotas próximas a vencer
     */
    por_vencer: porVencer
  };
}


/**
 * =========================================================
 * EXPORTAR
 * =========================================================
 */
module.exports = {
  obtenerNotificacionesPagos
};
