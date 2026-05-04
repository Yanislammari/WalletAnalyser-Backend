export interface ETFHolding {
  investment_security: ETFconcentration;
}

interface ETFconcentration {
  name: string;
  percent_value: number;
  invested_country: string;
}
