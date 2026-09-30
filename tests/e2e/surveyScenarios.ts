export interface SurveyStep {
  stepNumber: number;
  questionType: 'single_choice' | 'multiple_choice' | 'text_input' | 'slider' | 'ranking';
  questionIdentifier?: string; // Texto o etiqueta para ubicar la pregunta si es necesario
  answers: string | string[]; // El valor o valores a ingresar/seleccionar
  requiresOk: boolean;        // Si requiere hacer clic en el botón OK interno de la pregunta
  expectedResult?: string;    // Opcional: descripción de validación o estado esperado
}

export interface SurveyScenario {
  flowName: string;
  surveyUrl: string;
  steps: SurveyStep[];
}

export const surveyScenarios: SurveyScenario[] = [
  {
    flowName: 'Flujo_Principal_HappyPath',
    surveyUrl: 'AQUÍ_PEGAS_LA_URL_DE_TU_SURVEY',
    steps: [
      {
        stepNumber: 1,
        questionType: 'single_choice',
        answers: 'Opción A',
        requiresOk: false // Las de opción simple a veces avanzan directo o usan Next
      },
      {
        stepNumber: 2,
        questionType: 'multiple_choice',
        answers: ['Opción 1', 'Opción 3'],
        requiresOk: true // Requiere el OK que discutimos antes de avanzar
      },
      {
        stepNumber: 3,
        questionType: 'text_input',
        answers: 'Respuesta de texto abierta de prueba',
        requiresOk: true // Requiere OK para fijar el texto
      },
      {
        stepNumber: 4,
        questionType: 'slider',
        answers: '75',
        requiresOk: false
      }
    ]
  }
];