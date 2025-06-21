export interface ItodoItem {
  id: number;
  content: string;
  complete: boolean;
}

export interface Iuser {
  id?: number;
  username: string;
  password: string;
  TodoList?: ItodoItem[];
}
