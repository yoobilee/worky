export interface Contact {
  id: string;
  name: string;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  kakaoId?: string | null;
  birthday?: string | null;
  memo?: string | null;
  tags: string[];
}

export interface ContactFormState {
  name: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  kakaoId: string;
  birthday: string;
  memo: string;
  tags: string[];
}
