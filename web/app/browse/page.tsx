'use client';
import { useState } from 'react';
import Header from '@/components/layout/header/Header';
import useMarkets from '@/hooks/useMarkets';

/**
 * Use the page component to wrap the components
 * that you want to render on the page.
 */
export default function HomePage() {

  const {loading, data} = useMarkets()
  const [filter, setFilter] = useState('');

  console.log('data', data, loading)

  const filteredData = data.filter(market => market.lltv !== '0' && market.collateralAsset != undefined);


  return (
    <div className="flex flex-col justify-between ">
      <Header />
      <div className='container gap-8' style={{padding: '0 5%'}}>
        <h1> Browse </h1>
        <input
        className='p-2 bg-opacity-20'
        type="text"
        placeholder="Search for an asset"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{ textAlign: 'left', borderRadius: '5px' }}
      />
{
        loading ? <div> Loading... </div> : 
         data == null ? <div> No data </div> :
        (
          <div className='bg-monarch-soft-black'>
          <table className='font-roboto w-full'>
            <thead className='table-header'>
              <tr>
                <th> Id </th>
                <th> Collateral </th>
                <th> Loan </th>
                <th> APY(%) </th>
                <th> LLTV </th>
                <th> Actions </th>
              </tr>
            </thead>
            <tbody className='table-body'>
              {filteredData.map((item, index) => (
                <tr key={index.toFixed()}>
                  <td className='items-center text-center'>{item.id.slice(0, 4)}</td>
                  <td>{item.collateralAsset.symbol}</td>
                  <td>{item.loanAsset.symbol}</td>
                  <td>{(item.state.supplyApy * 100).toFixed(3)}</td>
                  <td>{Number(item.lltv) / 1e18}</td>
                  <td>
                    <button >Detail</button>
                    <button>Supply</button>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
        </div>
        )
      }
      </div>
    </div>
  );
}
