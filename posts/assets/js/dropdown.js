const buttons = document.querySelectorAll(".code-dropdown-btn")

function toggleDrop(event){
    const btn = event.currentTarget
    const targetID = btn.getAttribute("data-target")
    const expanded = btn.getAttribute("data-expanded")
    console.log(targetID)
    if (expanded === "true"){
        document.getElementById(targetID).style.display = "none"
        btn.setAttribute("data-expanded", "false")
        btn.firstChild.classList.replace("fa-caret-up", 'fa-caret-down')
    } else {
        document.getElementById(targetID).style.display = "block"
        btn.setAttribute("data-expanded", "true")
        btn.firstChild.classList.replace("fa-caret-down", 'fa-caret-up')
    }
}

buttons.forEach(btn => {
    btn.addEventListener("click", toggleDrop)
    console.log()
})
