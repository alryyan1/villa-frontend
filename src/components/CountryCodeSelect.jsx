import { Select } from 'antd';
import { COUNTRY_DIAL_OPTIONS, DEFAULT_PHONE_COUNTRY_CODE } from '../data/countryDialCodes';

// Dedicated phone country-code picker. The value is just the numeric calling
// code (e.g. "968") — combining it with the local number only happens
// server-side when a WhatsApp message is actually sent.
export default function CountryCodeSelect({ value = DEFAULT_PHONE_COUNTRY_CODE, onChange = (_v) => {}, style = {} }) {
  return (
    <Select
      showSearch
      value={value ?? DEFAULT_PHONE_COUNTRY_CODE}
      onChange={onChange}
      options={COUNTRY_DIAL_OPTIONS}
      filterOption={(input, option) => !!option?.search?.includes(input.toLowerCase())}
      style={{ width: 150, ...style }}
    />
  );
}
