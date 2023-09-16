import contacts from "./contacts.json";

const db = contacts as Contact[];

export type Contact = {
  id: number;
  first: string | null;
  last: string | null;
  phone: string | null;
  email: string;
  errors: Record<string, string>;
};

export const count = db.length;

const PAGE_SIZE = 10;

export const all = (page = 1) => {
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  return contacts.slice(start, end);
};

export const search = (text: string): Contact[] => {
  const textLower = text.toLowerCase();
  return db.filter((c) => {
    const x =
      c.first?.toLowerCase().includes(textLower) ||
      c.last?.toLowerCase().includes(textLower) ||
      c.phone?.includes(textLower) ||
      c.email.toLowerCase().includes(textLower);
    return x;
  });
};

export const find = (id: number): Contact | undefined => {
  const contact = db.find((c) => c.id === id);
  if (!contact) {
    return undefined;
  }
  contact.errors = {};
  return contact;
};

export const validate = (contact: Contact): boolean => {
  // check if email is unique
  const existing = db.find((c) => c.email === contact.email);
  if (existing && existing.id !== contact.id) {
    contact.errors.email = "Email must be unique";
  }
  return Object.keys(contact.errors ?? {}).length === 0;
};

export const save = (contact: Contact): boolean => {
  if (!validate(contact)) {
    return false;
  }
  if (!contact.id) {
    contact.id = db.length + 1;
    db.push(contact);
  } else {
    const index = db.findIndex((c) => c.id === contact.id);
    db[index] = contact;
  }
  return true;
};

export const remove = (id: number): void => {
  const index = db.findIndex((c) => c.id === id);
  db.splice(index, 1);
};
