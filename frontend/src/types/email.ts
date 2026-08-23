export interface Email {
  id: number;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_time: string;
  status: string;
  sent_time: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}
