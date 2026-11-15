/**
 * Copia en TypeScript de experimental/explorar/docs/referencias/layout.json (medido de los bocetos
 * con experimental/explorar/tools/analizar_bocetos.py). Se usa .ts en vez de .json para no cambiar
 * la configuración de TypeScript del visor. Si se vuelve a medir, regenerar esta copia.
 */
const layout = {
  "version": 1,
  "generado_por": "tools/analizar_bocetos.py",
  "coordenadas": "u = x/ancho, v = y/alto en [0,1] sobre el área de dibujo, sin la franja superior de la captura",
  "navegacion": {
    "archivo": "boceto-navegacion.png",
    "sha256": "8f75d67045090f7bce1c2a168d68851c0c1845c0a728ddc91a8bdf18d68e7295",
    "tamano_px": [
      1574,
      687
    ],
    "franja_superior_px": 9,
    "aspecto": 2.3215,
    "objetos": [
      {
        "hueco_caja": [
          0.8323,
          0.6401,
          0.0318,
          0.0442
        ],
        "cuerpo_caja": [
          0.7421,
          0.6165,
          0.0896,
          0.1136
        ],
        "centroide": [
          0.7958,
          0.6735
        ],
        "caja": [
          0.7421,
          0.6165,
          0.1271,
          0.115
        ],
        "area_rel": 0.0096,
        "tamano_rel": 0.295,
        "redondez": 0.5016,
        "aspecto": 2.5641,
        "solidez": 0.8879,
        "angulo_deg": -4.0198,
        "elongacion": 2.5061,
        "huecos": 1,
        "area_hueco_rel": 0.0009,
        "toca_borde": false,
        "clase": "station",
        "confianza": "alta",
        "nota": "Cilindro horizontal con un asa (anillo) en el extremo derecho; el asa encierra un hueco.",
        "id": "ancla",
        "ancla": {
          "centro": [
            0.7869,
            0.6733
          ],
          "diametro_v": 0.1136,
          "largo_v": 0.208,
          "asa_largo_v": 0.0871,
          "asa_alto_v": 0.0562,
          "metodo": "centro del cilindro (sin el asa); el asa sale por el extremo derecho"
        }
      },
      {
        "centroide": [
          0.6384,
          0.3392
        ],
        "caja": [
          0.6264,
          0.3097,
          0.026,
          0.0619
        ],
        "area_rel": 0.0011,
        "tamano_rel": 0.0619,
        "redondez": 0.7728,
        "aspecto": 0.9762,
        "solidez": 0.9516,
        "angulo_deg": -42.0248,
        "elongacion": 1.4952,
        "huecos": 0,
        "area_hueco_rel": 0.0,
        "toca_borde": false,
        "clase": "smallBody",
        "confianza": "alta",
        "nota": "",
        "id": "c1",
        "ancla": {
          "centro": [
            0.6394,
            0.3406
          ],
          "diametro_v": 0.0619,
          "metodo": "centro de la caja"
        }
      },
      {
        "centroide": [
          0.1964,
          0.2975
        ],
        "caja": [
          0.1881,
          0.2817,
          0.0197,
          0.0324
        ],
        "area_rel": 0.0005,
        "tamano_rel": 0.0457,
        "redondez": 0.7962,
        "aspecto": 1.4091,
        "solidez": 0.9684,
        "angulo_deg": -13.8945,
        "elongacion": 1.4332,
        "huecos": 0,
        "area_hueco_rel": 0.0,
        "toca_borde": false,
        "clase": "smallBody",
        "confianza": "alta",
        "nota": "",
        "id": "c2",
        "ancla": {
          "centro": [
            0.1979,
            0.2979
          ],
          "diametro_v": 0.0457,
          "metodo": "centro de la caja"
        }
      },
      {
        "centroide": [
          0.3331,
          0.2563
        ],
        "caja": [
          0.3259,
          0.233,
          0.0159,
          0.0516
        ],
        "area_rel": 0.0004,
        "tamano_rel": 0.0516,
        "redondez": 0.3506,
        "aspecto": 0.7143,
        "solidez": 0.7101,
        "angulo_deg": -67.7179,
        "elongacion": 2.2356,
        "huecos": 0,
        "area_hueco_rel": 0.0,
        "toca_borde": false,
        "clase": "smallBody",
        "confianza": "alta",
        "nota": "Forma irregular (triangular o alargada).",
        "id": "c3",
        "ancla": {
          "centro": [
            0.3339,
            0.2588
          ],
          "diametro_v": 0.0516,
          "metodo": "centro de la caja"
        }
      },
      {
        "centroide": [
          0.1791,
          0.2237
        ],
        "caja": [
          0.1747,
          0.2168,
          0.0102,
          0.0147
        ],
        "area_rel": 0.0001,
        "tamano_rel": 0.0236,
        "redondez": 0.6664,
        "aspecto": 1.6,
        "solidez": 0.913,
        "angulo_deg": -21.928,
        "elongacion": 1.9351,
        "huecos": 0,
        "area_hueco_rel": 0.0,
        "toca_borde": false,
        "clase": "smallBody",
        "confianza": "alta",
        "nota": "",
        "id": "c4",
        "ancla": {
          "centro": [
            0.1798,
            0.2241
          ],
          "diametro_v": 0.0236,
          "metodo": "centro de la caja"
        }
      },
      {
        "centroide": [
          0.7209,
          0.5612
        ],
        "caja": [
          0.7135,
          0.5413,
          0.0165,
          0.0413
        ],
        "area_rel": 0.0006,
        "tamano_rel": 0.0413,
        "redondez": 0.8487,
        "aspecto": 0.9286,
        "solidez": 0.9736,
        "angulo_deg": -60.4866,
        "elongacion": 1.2465,
        "huecos": 0,
        "area_hueco_rel": 0.0,
        "toca_borde": false,
        "clase": "sphere",
        "confianza": "media",
        "nota": "Hay dos manchas redondas a la derecha; se toma la más cercana al centro-derecha. La otra queda como cuerpo pequeño.",
        "id": "esfera",
        "ancla": {
          "centro": [
            0.7218,
            0.5619
          ],
          "diametro_v": 0.0413,
          "metodo": "centro de la caja"
        }
      },
      {
        "centroide": [
          0.0979,
          0.1417
        ],
        "caja": [
          0.0718,
          0.0929,
          0.0559,
          0.1003
        ],
        "area_rel": 0.0039,
        "tamano_rel": 0.1298,
        "redondez": 0.6319,
        "aspecto": 1.2941,
        "solidez": 0.8786,
        "angulo_deg": -29.2531,
        "elongacion": 1.3481,
        "huecos": 0,
        "area_hueco_rel": 0.0,
        "toca_borde": false,
        "clase": "planet",
        "confianza": "alta",
        "nota": "",
        "id": "ilmara",
        "ancla": {
          "centro": [
            0.0998,
            0.1431
          ],
          "diametro_v": 0.1298,
          "metodo": "centro de la caja"
        }
      },
      {
        "centroide": [
          0.8223,
          0.3305
        ],
        "caja": [
          0.7738,
          0.2552,
          0.0883,
          0.1431
        ],
        "area_rel": 0.0073,
        "tamano_rel": 0.205,
        "redondez": 0.4098,
        "aspecto": 1.433,
        "solidez": 0.8357,
        "angulo_deg": -11.2615,
        "elongacion": 1.7144,
        "huecos": 0,
        "area_hueco_rel": 0.0,
        "toca_borde": false,
        "clase": "ringedPlanet",
        "confianza": "media",
        "nota": "Mancha irregular con una prolongación inclinada (el anillo) y trazos sueltos; el disco y el anillo se funden. Inclinación del anillo tomada del eje mayor.",
        "id": "orun",
        "ancla": {
          "centro": [
            0.818,
            0.3267
          ],
          "diametro_v": 0.205,
          "metodo": "centro de la caja"
        }
      },
      {
        "centroide": [
          0.0885,
          0.0249
        ],
        "caja": [
          0.0616,
          0.0,
          0.0559,
          0.0546
        ],
        "area_rel": 0.0023,
        "tamano_rel": 0.1298,
        "redondez": 0.5044,
        "aspecto": 2.3784,
        "solidez": 0.9034,
        "angulo_deg": -9.1485,
        "elongacion": 2.8075,
        "huecos": 0,
        "area_hueco_rel": 0.0,
        "toca_borde": true,
        "clase": "planet",
        "confianza": "media",
        "nota": "Recortado por el borde superior: solo se ve la mitad inferior. Se completa como esfera del mismo ancho.",
        "id": "veshta",
        "ancla": {
          "centro": [
            0.0896,
            -0.0103
          ],
          "diametro_v": 0.1298,
          "metodo": "esfera completada desde el borde inferior"
        }
      }
    ],
    "nave": {
      "caja": [
        0.3374,
        0.3879,
        0.2745,
        0.5324
      ],
      "puntos": {
        "nariz": [
          0.46,
          0.3879
        ],
        "ala_izquierda": [
          0.3374,
          0.8024
        ],
        "ala_derecha": [
          0.6118,
          0.7847
        ],
        "hombro": [
          0.46,
          0.5457
        ],
        "motor_abajo": [
          0.46,
          0.9204
        ],
        "motor_arriba": [
          0.46,
          0.8466
        ]
      },
      "lineas_horizontales_v": [
        0.5457,
        0.6888,
        0.8466,
        0.9086
      ],
      "proporciones": {
        "envergadura_sobre_largo": 1.1967,
        "nariz_sobre_largo": 0.2964,
        "ancho_cuerpo_sobre_envergadura": 0.2454,
        "alto_motor_sobre_largo": 0.1385,
        "punta_ala_desde_nariz_sobre_largo": 0.7618,
        "barrido_borde_ataque_deg": 45.8654
      },
      "largo_rel_alto": 0.5324,
      "envergadura_rel_ancho": 0.2745,
      "ajuste": {
        "metodo": "mínimos cuadrados (scipy) sobre 6 puntos de la silueta; pantalla 16:9, FOV 50°, nave a 4,6 u",
        "parametros": {
          "nariz_z": -2.8482,
          "hombro_z": -1.1007,
          "motor_z": 1.35,
          "punta_x": 2.6137,
          "punta_z": 0.9447,
          "cabeceo": 1.1497,
          "escala": 0.5028,
          "y": -0.7687
        },
        "cola_z": 1.95,
        "objetivo_16_9": {
          "nariz": [
            0.4809,
            0.3879
          ],
          "ala_izquierda": [
            0.3208,
            0.8024
          ],
          "ala_derecha": [
            0.6791,
            0.7847
          ],
          "hombro": [
            0.4809,
            0.5457
          ],
          "motor_abajo": [
            0.4809,
            0.9204
          ],
          "motor_arriba": [
            0.4809,
            0.8466
          ]
        },
        "error_por_punto": {
          "nariz": 0.0191,
          "ala_izquierda": 0.0087,
          "ala_derecha": 0.0091,
          "hombro": 0.0191,
          "motor_abajo": 0.0201,
          "motor_arriba": 0.0203
        },
        "error_max": 0.0203
      }
    },
    "cruceta": {
      "centro": [
        0.9571,
        0.7952
      ],
      "botones": {
        "arriba": {
          "centroide": [
            0.9491,
            0.6729
          ],
          "caja": [
            0.906,
            0.6121,
            0.0864,
            0.1401
          ],
          "toca_borde": false,
          "triangulo": true
        },
        "derecha": {
          "centroide": [
            0.9905,
            0.8273
          ],
          "caja": [
            0.9822,
            0.8245,
            0.0178,
            0.0088
          ],
          "toca_borde": true,
          "triangulo": false
        },
        "izquierda": {
          "centroide": [
            0.9032,
            0.8056
          ],
          "caja": [
            0.8837,
            0.764,
            0.0407,
            0.0826
          ],
          "toca_borde": false,
          "triangulo": true
        },
        "abajo": {
          "centroide": [
            0.9542,
            0.8933
          ],
          "caja": [
            0.9371,
            0.8584,
            0.0343,
            0.0841
          ],
          "toca_borde": false,
          "triangulo": false
        }
      },
      "disposicion": "cruz",
      "nota": "El botón derecho está cortado por el borde de la captura."
    }
  },
  "seleccion": {
    "archivo": "boceto-seleccion.png",
    "sha256": "abe4b600efd5dcf3040f99c0eb589e51e270f23eaa4a75ba3904143e6c5804aa",
    "tamano_px": [
      1574,
      687
    ],
    "franja_superior_px": 3,
    "marco": {
      "caja": [
        0.04,
        0.0892,
        0.4441,
        0.8699
      ],
      "aspecto": 1.1748
    },
    "circulos_detectados": 3,
    "menu": {
      "centro": [
        0.0722,
        0.0874
      ],
      "tamano_rel_marco": [
        0.1016,
        0.121
      ],
      "posicion": "arriba a la izquierda, dentro del marco"
    },
    "sectores": {
      "alpha": {
        "centro": [
          0.3226,
          0.2697
        ],
        "diametro_rel_marco": 0.0633,
        "redondez": 0.7769,
        "etiqueta_encima": true
      },
      "beta": {
        "centro": [
          0.6524,
          0.3529
        ],
        "diametro_rel_marco": 0.0809,
        "redondez": 0.8002,
        "etiqueta_encima": true
      },
      "epsilon": {
        "centro": [
          0.4571,
          0.6521
        ],
        "diametro_rel_marco": 0.0876,
        "redondez": 0.7192,
        "etiqueta_encima": true
      }
    },
    "llamada": {
      "lado": "derecha",
      "desplazamiento_rel_diametro": 5.6275,
      "alineacion_vertical": "centrada",
      "lineas_guia": 3,
      "nota": "Trazos que salen del círculo hacia la derecha y terminan en el texto «sector el cual quieren visitar»."
    },
    "anotaciones": {
      "cajas_flujo": 2,
      "nota": "Fuera del marco: «Menu → Exp» (dos cajas y una flecha) y un círculo encima de «Menu». Se lee como «el menú lleva a la sección Explorar». No es parte de la pantalla."
    }
  }
}

export default layout
