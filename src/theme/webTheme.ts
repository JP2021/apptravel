import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/**
 * Estilos aplicados apenas na versão web para um visual moderno.
 * Sombras e bordas que no mobile são desnecessários.
 */
export const webCard = isWeb
  ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(99, 139, 255, 0.15)',
    }
  : {};

export const webHero = isWeb
  ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 10,
      borderRadius: 20,
      borderColor: 'rgba(99, 139, 255, 0.2)',
    }
  : {};

export const webButton = isWeb
  ? {
      shadowColor: '#1D4ED8',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
      borderRadius: 14,
    }
  : {};

export const webTabBar = isWeb
  ? {
      borderTopWidth: 0,
      borderRadius: 24,
      marginHorizontal: 24,
      marginBottom: 16,
      marginTop: 0,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 8,
      height: 64,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 16,
      overflow: 'hidden' as const,
      borderWidth: 1,
      borderColor: 'rgba(99, 139, 255, 0.2)',
    }
  : {};

/**
 * Na web: root ocupa a viewport e esconde overflow do body para evitar
 * scroll duplo. Altura fixa para o scroll ficar só dentro do app.
 */
export const webScreen = isWeb
  ? {
      height: '100vh' as const,
      minHeight: '100vh' as const,
      maxHeight: '100vh' as const,
      overflow: 'hidden' as const,
    }
  : {};

/** Padding extra no final do scroll na web para o footer ficar clicável. */
export const webScrollPaddingBottom = isWeb ? 80 : 0;

export const isWebPlatform = isWeb;
