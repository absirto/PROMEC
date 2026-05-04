export interface ServiceOrder {
    id: number;
    description?: string; // made optional just in case
    customerName?: string; 
    person?: Person;
}

export interface NaturalPerson {
    name: string;
}

export interface LegalPerson {
    fantasyName: string;
}

export interface Person {
    id: number;
    naturalPerson?: NaturalPerson;
    legalPerson?: LegalPerson;
    type: 'F' | 'J';
    name?: string;
}

export interface Employee {
    id: number;
    person: Person;
}

export interface NonConformity {
    id?: number;
    tempId?: number; // Frontend helper
    type: string;
    problemDescription: string;
    suggestedAction: string;
    responsibleId: number | string;
    responsible?: Employee;
    deadline: string;
    status: string;
}
