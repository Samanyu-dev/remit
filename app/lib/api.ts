export async function post<T = Record<string, string>>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}
