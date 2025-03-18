export const DisplayArea = ({ area }: { area: number }) => {
    return (
        <div style={{
            position: 'absolute',
            bottom: 2,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0px 10px',
            backgroundColor: 'black',
            color: 'white',
            opacity: .7,
            borderRadius: '5px',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column'
        }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0px 2px', margin: 0 }}>
                <p style={{ color: 'white', margin: 0, padding: 0 }}><span style={{ color: area >= 200 ? 'red' : 'green' }}>Area: <span id="clipped-polygon-area">{area}</span> km<sup>2</sup></span> - Max area 200 km<sup>2</sup></p>
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '5px 2px' }}>
                <input type="text" placeholder="Input area name" style={{
                    display: 'block',
                    width: '100%',
                    margin: '5px 0',
                    padding: '5px 0px 5px 5px',
                    borderRadius: '3px',
                    border: '1px solid #ccc'
                }}></input>
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '5px 2px' }}>
                <input type="number" placeholder="Input min zoom level" style={{
                    display: 'block',
                    margin: '5px 2',
                    padding: '5px 0px 5px 5px',
                    borderRadius: '3px',
                    border: '1px solid #ccc'
                }}></input>
                <input type="number" placeholder="Input max zoom level" style={{
                    display: 'block',
                    margin: '5px 2',
                    padding: '5px 0px 5px 5px',
                    borderRadius: '3px',
                    border: '1px solid #ccc'
                }}></input>
            </div>

            <button style={{
                display: 'block',
                width: '100%',
                margin: '5px 0',
                padding: '10px',
                borderRadius: '3px',
                border: 'none',
                backgroundColor: area >= 200 ? 'grey' : '#4CAF50',
                color: 'white',
                cursor: 'pointer'

            }} disabled={area >= 200}>Save</button>
        </div>
    )
}