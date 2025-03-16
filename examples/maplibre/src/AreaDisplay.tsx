export const DisplayArea = ({ area }: { area: number }) => {
    return (
        <div style={{
            position: 'absolute',
            bottom: 5,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0px 10px',
            backgroundColor: 'black',
            color: 'white',
            opacity: .7,
            borderRadius: '5px',
            zIndex: 1
        }}>
            <p style={{ color: 'white' }}>Max area 200 km<sup>2</sup>, <span style={{ color: area >= 200 ? 'red' : 'green' }}>Area: <span id="clipped-polygon-area">{area}</span> km<sup>2</sup></span></p>
        </div>
    )
}