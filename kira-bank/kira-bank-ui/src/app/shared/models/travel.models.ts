export interface TravelMember { id: string; name: string; }
export interface TravelActivity { id: string; date: string; time: string; title: string; location: string; notes: string; }
export interface TravelPacking { id: string; name: string; category: string; quantity: number; packed: boolean; }
export interface TravelExpense { id: string; title: string; date: string; amount: number; paidBy: string; participants: string[]; }
export interface TravelBooking { id: string; title: string; type: string; reference: string; date: string; notes: string; url: string; }
export interface TravelPlace { id: string; name: string; address: string; latitude: number; longitude: number; notes: string; visited: boolean; }
export interface TravelData {
  name: string; destination: string; startDate: string; endDate: string; timezone: string; currency: string;
  budget: number; notes: string; members: TravelMember[]; activities: TravelActivity[];
  packing: TravelPacking[]; expenses: TravelExpense[]; bookings: TravelBooking[]; places: TravelPlace[];
}
export interface TravelTrip {
  id: string; version: number; data: TravelData;
  summary: { total: number; balances: { memberId: string; paid: number; share: number; net: number }[];
    transfers: { from: string; to: string; amount: number }[] };
}
export interface TravelFile { id: string; name: string; contentType: string; size: number; }
