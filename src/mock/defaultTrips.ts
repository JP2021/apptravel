import { Trip } from '../types';

export const defaultTrips: Trip[] = [
  {
    id: 'mock-roma-1',
    destination: 'Roma',
    startDate: '2026-06-14',
    endDate: '2026-06-17',
    days: [
      {
        id: 'mock-day-1',
        date: '2026-06-14',
        type: 'voo',
        title: 'Ida para Roma - ITA Airways AZ 709',
        time: '22:45',
        location: 'Aeroporto Internacional de Guarulhos, Sao Paulo',
        notes: 'Dia de embarque e chegada',
        details: {
          airline: 'ITA Airways',
          flightNumber: 'AZ 709',
          terminalGate: 'T3 • B12',
          departure: 'GRU',
          arrival: 'FCO',
        },
        activities: [
          {
            id: 'mock-day-1-act-1',
            title: 'Check-in e despacho de bagagem',
            time: '19:30',
            location: 'Terminal 3 - Guarulhos',
          },
          {
            id: 'mock-day-1-act-2',
            title: 'Embarque no voo para Roma',
            time: '22:10',
            location: 'Portao B12',
          },
        ],
        checklistItems: ['Passaporte', 'Seguro viagem', 'Carregador universal'],
        attachments: [
          {
            name: 'voucher-voo-ida.pdf',
            uri: 'https://example.com/voucher-voo-ida.pdf',
          },
        ],
      },
      {
        id: 'mock-day-2',
        date: '2026-06-15',
        type: 'hotel',
        title: 'Check-in + passeios em Roma',
        time: '14:00',
        location: 'Via Nazionale, 22, Roma',
        notes: 'Hospedagem e atividades do centro historico',
        details: {
          hotelName: 'Hotel Artemide Roma',
          checkIn: '14:00',
          checkOut: '11:00',
          reservationCode: 'RM8K4P',
        },
        activities: [
          {
            id: 'mock-day-2-act-1',
            title: 'Visita ao Coliseu',
            time: '09:00',
            location: 'Piazza del Colosseo',
          },
          {
            id: 'mock-day-2-act-2',
            title: 'Passeio na Fontana di Trevi',
            time: '16:30',
            location: 'Piazza di Trevi',
          },
        ],
        checklistItems: ['Documento da reserva', 'Ingresso Coliseu'],
        attachments: [
          {
            name: 'voucher-hotel-artemide.pdf',
            uri: 'https://example.com/voucher-hotel-artemide.pdf',
          },
        ],
      },
      {
        id: 'mock-day-3',
        date: '2026-06-16',
        type: 'atividade',
        title: 'Dia de museus e gastronomia',
        time: '08:30',
        location: 'Roma Centro',
        notes: 'Dia completo de experiencias locais',
        details: {
          activityCategory: 'Cultura e Gastronomia',
          ticketInfo: 'Ingressos reservados online',
        },
        activities: [
          {
            id: 'mock-day-3-act-1',
            title: 'Museus Vaticanos e Capela Sistina',
            time: '10:00',
            location: 'Viale Vaticano, Roma',
          },
          {
            id: 'mock-day-3-act-2',
            title: 'Jantar no Trastevere',
            time: '20:00',
            location: 'Trastevere, Roma',
          },
        ],
        checklistItems: ['Ingresso do Vaticano', 'Cartao de transporte'],
        attachments: [
          {
            name: 'ingressos-museus-vaticanos.pdf',
            uri: 'https://example.com/ingressos-museus-vaticanos.pdf',
          },
        ],
      },
      {
        id: 'mock-day-4',
        date: '2026-06-17',
        type: 'voo',
        title: 'Dia da volta para o Brasil',
        time: '20:15',
        location: 'Aeroporto Fiumicino (FCO), Roma',
        notes: 'Encerramento da viagem e retorno',
        details: {
          airline: 'ITA Airways',
          flightNumber: 'AZ 710',
          terminalGate: 'T1 • A08',
          departure: 'FCO',
          arrival: 'GRU',
        },
        activities: [
          {
            id: 'mock-day-4-act-1',
            title: 'Check-out no hotel',
            time: '10:30',
            location: 'Hotel Artemide Roma',
          },
          {
            id: 'mock-day-4-act-2',
            title: 'Transfer para o aeroporto e embarque',
            time: '17:30',
            location: 'Roma -> FCO',
          },
        ],
        checklistItems: ['Passaporte', 'Cartao de embarque', 'Tax free receipts'],
        attachments: [
          {
            name: 'voucher-voo-volta.pdf',
            uri: 'https://example.com/voucher-voo-volta.pdf',
          },
        ],
      },
    ],
    createdAt: '2026-02-23T12:00:00.000Z',
    updatedAt: '2026-02-23T12:00:00.000Z',
  },
];
