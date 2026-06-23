/**
 * getSlicedAddress returns the first 5 and last 4 characters of an address.
 */
export const getSlicedAddress = (address: string | undefined) => {
  if (!address) {
    return '';
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
};
