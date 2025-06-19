export class Address {
  constructor(
    private readonly street: string,
    private readonly city: string,
    private readonly state: string,
    private readonly zip: string
  ) {
    if (!street?.trim()) {
      throw new Error('Street is required');
    }
    if (!city?.trim()) {
      throw new Error('City is required');
    }
    if (!state?.trim()) {
      throw new Error('State is required');
    }
    if (!zip?.trim()) {
      throw new Error('Zip code is required');
    }
  }
  
  getStreet(): string {
    return this.street;
  }
  
  getCity(): string {
    return this.city;
  }
  
  getState(): string {
    return this.state;
  }
  
  getZip(): string {
    return this.zip;
  }
  
  toString(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.zip}`;
  }
  
  equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.city === other.city &&
      this.state === other.state &&
      this.zip === other.zip
    );
  }
}