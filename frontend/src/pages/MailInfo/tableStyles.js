export const tableStyles = {
    table: {
        style: {
            overflow: 'hidden',
            minWidth: '100%',
        },
    },
    header: { style: { minHeight: '56px' } },
    headCells: {
        style: {
            backgroundColor: '#f8f9fa',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            fontSize: '12px',
            padding: '12px 8px'
        },
    },
    rows: {
        style: {
            fontSize: '11px',
            fontWeight: '500',
            color: '#495057',
            minHeight: '65px',
            padding: '0',
            '&:not(:last-of-type)': {
                borderBottom: '1px solid #f1f1f1',
            },
        },
        highlightOnHoverStyle: {
            backgroundColor: '#EBF4FF',
            color: '#0056b3',
            cursor: 'pointer',
            transitionDuration: '0.2s',
        },
    },
};
