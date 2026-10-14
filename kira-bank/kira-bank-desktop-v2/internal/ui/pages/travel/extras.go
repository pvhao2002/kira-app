package travel

import "encoding/json"

// The blob is saved whole, so fields this app does not model (written by the web
// UI or a newer server) must survive a load/edit/save cycle. Every blob object
// keeps them in X and merges the typed fields over them on marshal.

type extras = map[string]json.RawMessage

func decodeWithExtras(b []byte, typed any, x *extras) error {
	if err := json.Unmarshal(b, typed); err != nil {
		return err
	}
	known, err := encodeMap(typed)
	if err != nil {
		return err
	}
	var all extras
	if err := json.Unmarshal(b, &all); err != nil {
		return err
	}
	*x = nil
	for k, v := range all {
		if _, ok := known[k]; !ok {
			if *x == nil {
				*x = extras{}
			}
			(*x)[k] = v
		}
	}
	return nil
}

func encodeMap(typed any) (extras, error) {
	b, err := json.Marshal(typed)
	if err != nil {
		return nil, err
	}
	var m extras
	return m, json.Unmarshal(b, &m)
}

func encodeWithExtras(typed any, x extras) ([]byte, error) {
	m, err := encodeMap(typed)
	if err != nil {
		return nil, err
	}
	for k, v := range x {
		if _, ok := m[k]; !ok {
			m[k] = v
		}
	}
	return json.Marshal(m)
}

func (v *member) UnmarshalJSON(b []byte) error {
	type p member
	return decodeWithExtras(b, (*p)(v), &v.X)
}
func (v member) MarshalJSON() ([]byte, error) { type p member; return encodeWithExtras(p(v), v.X) }
func (v *activity) UnmarshalJSON(b []byte) error {
	type p activity
	return decodeWithExtras(b, (*p)(v), &v.X)
}
func (v activity) MarshalJSON() ([]byte, error) { type p activity; return encodeWithExtras(p(v), v.X) }
func (v *packing) UnmarshalJSON(b []byte) error {
	type p packing
	return decodeWithExtras(b, (*p)(v), &v.X)
}
func (v packing) MarshalJSON() ([]byte, error) { type p packing; return encodeWithExtras(p(v), v.X) }
func (v *expense) UnmarshalJSON(b []byte) error {
	type p expense
	return decodeWithExtras(b, (*p)(v), &v.X)
}
func (v expense) MarshalJSON() ([]byte, error) { type p expense; return encodeWithExtras(p(v), v.X) }
func (v *booking) UnmarshalJSON(b []byte) error {
	type p booking
	return decodeWithExtras(b, (*p)(v), &v.X)
}
func (v booking) MarshalJSON() ([]byte, error) { type p booking; return encodeWithExtras(p(v), v.X) }
func (v *place) UnmarshalJSON(b []byte) error {
	type p place
	return decodeWithExtras(b, (*p)(v), &v.X)
}
func (v place) MarshalJSON() ([]byte, error) { type p place; return encodeWithExtras(p(v), v.X) }
func (v *data) UnmarshalJSON(b []byte) error { type p data; return decodeWithExtras(b, (*p)(v), &v.X) }
func (v data) MarshalJSON() ([]byte, error)  { type p data; return encodeWithExtras(p(v), v.X) }
