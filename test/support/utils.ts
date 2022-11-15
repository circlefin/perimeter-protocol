export function findEventByName(receipt: any, name: string) {
  return receipt.events?.find((event: any) => event.event == name);
}
