import { onlyDigits } from './format';

export interface CepResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/**
 * Look up a Brazilian address by CEP using the public ViaCEP API (RF04).
 * Returns null on invalid/unknown CEP or network failure so callers can fall
 * back to manual entry.
 */
export async function lookupCep(rawCep: string): Promise<CepResult | null> {
  const cep = onlyDigits(rawCep);
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;
    return {
      cep,
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch {
    return null;
  }
}
