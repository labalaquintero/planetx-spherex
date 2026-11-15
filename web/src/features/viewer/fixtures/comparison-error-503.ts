/** Fixture de error 503: simula fallo temporal del archivo externo. */
export const error503Fixture = {
  status: 503,
  body: {
    error: {
      code: 'archive_unavailable' as const,
      message:
        'El servicio de archivo no está disponible temporalmente. Intente de nuevo en unos momentos.',
    },
  },
};
