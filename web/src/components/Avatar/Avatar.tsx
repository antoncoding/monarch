import Image from "next/image";
import { Address } from "viem";

export function Avatar({address}: {address: Address}) {
  return (<div> 
      <Image src={`https://effigy.im/a/${address}.svg`}
        alt={address}
        width={30}
        height={30}
        style={{borderRadius: '50%'}}
        />
    </div>)
}