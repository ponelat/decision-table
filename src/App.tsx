import React, {useMemo, useEffect} from 'react';
import useLocalStorage from './use-localstorage'
import produce from 'immer'
import logo from './logo.svg';
import './App.css';
import ContentEditable from 'react-contenteditable'
import DownloadStrAsFile from './download-file'
import './mousetrap.d'
import Mousetrap from 'mousetrap'

interface ColDefinition {
  header: string;
  enums: string[];
}

interface Data {
  definitions: ColDefinition[];
  rowMap: RowData;
}

interface RowData {
  [key: string]: {
    given?: string[];
    when?: string;
    then?: string;
    [key: string]: string | string[] | undefined;
  }
}

interface TValue {
  target: {
    value: string;
  }
}

const initDefinitions: ColDefinition[] = [
  {header: 'With Parent Node', enums: ['null', 'object', 'array']},
  {header: 'From Node', enums: ['null', 'string', 'number', 'bool']},
  {header: 'To Node', enums: ['null', 'object', 'array', 'string', 'number', 'bool']}
]

const rowCountFromColDefs = (colDefs: ColDefinition[]): number => {
  return colDefs.reduce((acc, def): number => acc * def.enums.length, 1)
}

const explodeRows = (base: string[][], pref: string[]=[]): string[][] => {
  const [head, ...rest] = base

  if(!rest.length)
    return head.map(l => {
      return [...pref, l]
    })

  return head.flatMap(l => {
    return explodeRows(rest, [...pref, l])
  })
}

const manyRowsFromColDefs = (colDefs: ColDefinition[]): string[][] => {
  return explodeRows(colDefs.map(d => d.enums))
}

// function rowsFromColDefinitions(colDefs: ColDefinition[]) : string[][] {
//   return colDefs.map(def => {
//     return
//   })
//   return [[]]
// }


function App() {
  const initData: Data = {
    definitions: initDefinitions,
    rowMap: {}
  }
  const initFilename = `decision-table.csv`

  const [data, setDataFn] = useLocalStorage('data', initData)
  const [filename, setFilename] = useLocalStorage('filename', initFilename)
  const [filters, setFilters] = useLocalStorage('filters', [])
  const {definitions, rowMap}: Data = data

  const setData = (data: Data | Function) => {
    const ret = setDataFn(data)
    return ret
  }

  // [true, false, pet] => "0/1/3", based on col definitions
  const rowHash = (row: string[]): string => {
    return row.map((r,i) => {
      return definitions[i].enums.findIndex(e => e === r)
    }).join('/')
  }

  // Generated rows
  const manyRows = useMemo(() => manyRowsFromColDefs(definitions), [definitions])
  const rowCount = manyRows.length

  const resetAll = () => {
    setData(produce(() => initData))
    setFilters([])
    setFilename(initFilename)
  }

  const resetRows = () => {
    setData(produce((data: Data) => {
      data.rowMap = {}
      return data
    }))
  }

  const resetFilters = () => {
    setFilters([])
  }

  const clearFilter = (i: number) => () => {
    setFilters(produce(filters => {
      delete filters[i]
      return filters
    }))
  }

  const downloadCsv = () => {
    const headers = [...definitions.map(def => `${def.header} (${def.enums.join('/')})`), 'when', 'then']
    const rows = manyRows.map(row => {
      let {when, then} = rowMap[rowHash(row)] || {}
      return [...row, when, then]
    })

    const csv = [headers, ...rows]
    const csvStr = csv.map(r => r.map(cell => JSON.stringify(cell)).join(',')).join('\n')

    DownloadStrAsFile(csvStr, filename, 'text/csv')
  }

  const getRowDataWhen = (row: string[]): string => {
    return (rowMap[rowHash(row)] || {}).when || ''
  }

  const getRowDataThen = (row: string[]): string => {
    return (rowMap[rowHash(row)] || {}).then || ''
  }

  const setRowData = (row: string[], key: string) => (e: TValue) => setData(produce((data: Data) => {
    let hash = rowHash(row)
    data.rowMap[hash] = data.rowMap[hash] || {}
    data.rowMap[hash][key] = e.target.value
    data.rowMap[hash].given = row
    return data
  }))

  const setColHeader = (i: number) => (val: TValue) => setData(produce((data: Data) => {
    data.definitions[i].header = val.target.value
    return data
  }))

  const removeCol = (i: number) => () => setData(produce((data: Data) => {
    data.definitions.splice(i, 1)

    // Move keys
    for(let key in data.rowMap) {
      let newKey = key.split('/').splice(i, 1).join('/')
      data.rowMap[newKey] = data.rowMap[key]
      delete data.rowMap[key]
    }

    return data
  }))

  const setColEnums = (i: number) => (val: TValue) => setData(produce((data: Data) => {
    data.definitions[i].enums = val.target.value.split('/')
    return data
  }))

  const newCol = () => setData(produce((data: Data) => {
    data.definitions.push({
      header: "New Column",
      enums: ['true', 'false']
    })

    // Move keys
    for(let key in data.rowMap) {
      data.rowMap[key + '/0'] = data.rowMap[key]
      delete data.rowMap[key]
    }

    return data
  }))

  const setFilter = (i: number) => (val: TValue) => setFilters(produce((filters: string[]) => {
    filters[i] = val.target.value.toLowerCase()
    return filters
  }))

  const setFilterByCell = (i: number, s: string) => () => setFilters(produce((filters: string[]) => {
    filters[i] = s
    return filters
  }))

  const filterRows = (row: string[], i: number): boolean => {
    return !filters.some((f: string,i: number) => {
      if(!f)
        return false
      return !f.split('|').map(g => g.trim()).some(f => {
        return row[i].toLowerCase().includes(f)
      })
    })
  }

  const rowsDone = useMemo(() => Object.keys(rowMap).length, [rowMap])

  const shownRows = manyRows.filter(filterRows)
  const numHiddenRows = manyRows.length - shownRows.length

  return (
    <div className="App">
      <h1>Decision Table</h1>
      <h3>
        <ContentEditable className="filename" html={filename} onChange={(e: TValue) => setFilename(e.target.value)}/>
        <button onClick={downloadCsv}>Download CSV</button>
      </h3>
      <button onClick={resetAll}>Reset All</button>
      <button onClick={resetRows}>Reset Data</button>
      <button onClick={resetFilters}>Reset Filters</button>

      <h4>Total: {rowCount} | When/Thens: {rowsDone} | Hidden {numHiddenRows}</h4>

      <table>
        <thead>
          <tr>
            <>
              {data.definitions.map((col: ColDefinition,i: number) => (
              <th key={i}>
                <ContentEditable className="heading" html={col.header} onChange={setColHeader(i)}/>
                <ContentEditable className="enums" html={col.enums.join('/')} onChange={setColEnums(i)}/>
                <div className="filter">
                  <ContentEditable placeholder="...filter|filter" html={filters[i] || ''} onChange={setFilter(i)}/>
                  { filters[i] ? (
                    <span className="clear-filter" onClick={clearFilter(i)}>x</span>
                  ) : null }
                </div>
                <button onClick={removeCol(i)}>-</button>
              </th>
            ))}
            </>
            <th> <button onClick={newCol}>+</button> </th>
            <th>When</th>
            <th>Then</th>
          </tr>
        </thead>
        <tbody>
          {shownRows.map((row, r) => (
            <tr key={rowHash(row)}>
              <>
                {row.map((cell, c) => {
                  return (
                    <td className="cell" key={c}>
                      {cell}
                      <span onClick={setFilterByCell(c, cell)}>o</span>
                    </td>
                  )
                })}
              </>
              <td>&nbsp;</td>
              <td>
                <ContentEditable className="when" html={getRowDataWhen(row)} onChange={setRowData(row, 'when')}/>
              </td>
              <td>
                <ContentEditable className="then" html={getRowDataThen(row)} onChange={setRowData(row, 'then')}/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}

export default App;
