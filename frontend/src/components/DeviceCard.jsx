//we are making a reusable component for our card
//we are making one component and passing diff data into using props
//displaying status and name of device with used and free space
//we are using props destruction
// Props (properties) are inputs that a parent component passes to a child 
// component so the child can display or use that data.
function DeviceCard({name,status,total_gb,used_gb}){
    const percentage=(used_gb/total_gb)*100
    return(
        <div className={`device-bubble ${status==="offline"?"offline":""}`}>
            <h3>{name}</h3>
            <p>Status : {status}</p>
            <p>{percentage}% used</p>
        </div>
    )
}
export default DeviceCard

// status === "offline" ? "offline" : ""

// Means:
// - Status offline hai? → "offline" return karo.
// - Nahi hai? → "" (empty string) return karo.