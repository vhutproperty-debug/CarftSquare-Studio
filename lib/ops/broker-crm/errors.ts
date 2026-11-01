export class BrokerCrmParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrokerCrmParseError';
  }
}

export class BrokerCrmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrokerCrmValidationError';
  }
}
