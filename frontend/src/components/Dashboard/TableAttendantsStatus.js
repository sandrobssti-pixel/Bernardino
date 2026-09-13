import React from "react";

import Paper from "@material-ui/core/Paper";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tooltip from '@material-ui/core/Tooltip';
import Skeleton from "@material-ui/lab/Skeleton";

import { makeStyles } from "@material-ui/core/styles";
import { green, grey } from '@material-ui/core/colors';

import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import moment from 'moment';

import Rating from '@material-ui/lab/Rating';
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
    on: {
        color: green[600],
        fontSize: '20px'
    },
    off: {
        color: grey[600],
        fontSize: '20px'
    },
    pointer: {
        cursor: "pointer"
    },
    tableContainer: {
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: "none"
    },
    tableHeadCell: {
        fontWeight: 700,
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.type === "light" ? "#f3f6fb" : "rgba(51,65,85,0.65)"
    },
    tableCell: {
        color: theme.palette.text.primary
    }
}));

export function RatingBox({ rating }) {
    const ratingTrunc = rating === null ? 0 : Math.trunc(rating);
    return <Rating
        defaultValue={ratingTrunc}
        max={3}
        readOnly
    />
}

export default function TableAttendantsStatus(props) {
    const { loading, attendants } = props
    const classes = useStyles();

    function renderList() {
        return attendants.map((a, k) => (
            <TableRow key={k}>
                <TableCell className={classes.tableCell}>{a.name}</TableCell>
                {/* <TableCell align="center" title="1 - Insatisfeito, 2 - Satisfeito, 3 - Muito Satisfeito" className={classes.pointer}>
                    <RatingBox rating={a.rating} />
                </TableCell> */}
                <TableCell className={classes.tableCell} align="center">{a.rating}</TableCell>
                <TableCell className={classes.tableCell} align="center">{a.countRating}</TableCell>
                <TableCell className={classes.tableCell} align="center">{a.tickets}</TableCell>
                <TableCell className={classes.tableCell} align="center">{formatTime(a.avgWaitTime, 2)}</TableCell>
                <TableCell className={classes.tableCell} align="center">{formatTime(a.avgSupportTime, 2)}</TableCell>
                <TableCell className={classes.tableCell} align="center">
                    {a.online ?
                        <Tooltip title="Online">
                            <CheckCircleIcon className={classes.on} />
                        </Tooltip>
                        :
                        <Tooltip title="Offline">
                            <ErrorIcon className={classes.off} />
                        </Tooltip>
                    }
                </TableCell>
            </TableRow>
        ))
    }

    function formatTime(minutes) {
        return moment().startOf('day').add(minutes, 'minutes').format('HH[h] mm[m]');
    }

    return (!loading ?
        <TableContainer component={Paper} className={classes.tableContainer}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell className={classes.tableHeadCell}>{i18n.t("dashboard.users.name")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("dashboard.assessments.score")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("dashboard.assessments.ratedCalls")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("dashboard.assessments.totalCalls")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("dashboard.cards.averageWaitingTime")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("dashboard.cards.averageServiceTime")}</TableCell>
                        <TableCell className={classes.tableHeadCell} align="center">{i18n.t("dashboard.cards.status")}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {renderList()}
                </TableBody>
            </Table>
        </TableContainer>
        : <Skeleton variant="rect" height={150} />
    )
}
